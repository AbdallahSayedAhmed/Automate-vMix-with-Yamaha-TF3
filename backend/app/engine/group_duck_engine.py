"""
Target-based multi-mic ducking stored on TriggerRule (is_multi_duck + duck_members JSON).

- Per-channel thresholds; shared silence_timeout_ms on the rule.
- One action per mic channel.
- Per-target restore: each target restores when no contributing mic is speaking.
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Set

from sqlalchemy.future import select

from app.db.database import AsyncSessionLocal
from app.db.models import TriggerRule

logger = logging.getLogger(__name__)

DEFAULT_FADE_MS = 700


def _parse_ms(value: str, default: int) -> int:
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return default
    return parsed if parsed >= 0 else default


def _parse_rule_fade(param_val: str) -> tuple[int, int]:
    """Parse shared attack/release fade timing for multi-mic rules."""
    s = str(param_val or "700,700")
    if "," in s:
        parts = s.split(",", 1)
        attack = _parse_ms(parts[0], DEFAULT_FADE_MS)
        release = _parse_ms(parts[1], attack)
        return attack, release
    return DEFAULT_FADE_MS, DEFAULT_FADE_MS


def _uses_smooth_fade(rule: Dict[str, Any]) -> bool:
    return (
        rule.get("action_target") == "yamaha"
        and str(rule.get("yamaha_command", "")).endswith("/Smooth")
    )


def _duck_action_value(rule: Dict[str, Any]) -> str:
    if _uses_smooth_fade(rule):
        return f"{rule['_duck_level']},{rule['_attack_ms']}"
    return str(rule["_duck_level"])


def _restore_rule_for_action(rule: Dict[str, Any]) -> Dict[str, Any]:
    restore_rule = dict(rule)
    if _uses_smooth_fade(rule):
        restore_rule["parameter_value"] = f"{rule['_duck_level']},{rule['_release_ms']}"
    else:
        restore_rule["parameter_value"] = str(rule["_duck_level"])
    return restore_rule


def member_to_action_dict(
    member: Dict[str, Any],
    member_id: int,
    rule_id: int,
    fade_attack_ms: int = DEFAULT_FADE_MS,
    fade_release_ms: int = DEFAULT_FADE_MS,
) -> Dict[str, Any]:
    duck_level = str(member.get("parameter_value", "-2500")).split(",")[0]
    action_target = member.get("action_target", "yamaha")
    yamaha_command = member.get("yamaha_command", "InCh/Fader/Smooth")
    action_value = (
        f"{duck_level},{fade_attack_ms}"
        if action_target == "yamaha" and str(yamaha_command).endswith("/Smooth")
        else duck_level
    )

    return {
        "id": member_id,
        "name": f"Rule {rule_id}",
        "sort_order": 0,
        "action_target": action_target,
        "yamaha_command": yamaha_command,
        "yamaha_channel": member.get("yamaha_channel", 10),
        "yamaha_mix": member.get("yamaha_mix", 0),
        "vmix_function": member.get("vmix_function"),
        "vmix_target_input": member.get("vmix_target_input"),
        "parameter_value": action_value,
        "_duck_level": duck_level,
        "_attack_ms": fade_attack_ms,
        "_release_ms": fade_release_ms,
        "_member_id": member_id,
        "_group_id": rule_id,
    }


def make_target_key(rule: Dict[str, Any]) -> str:
    if rule["action_target"] == "yamaha":
        return f"yamaha_{rule['yamaha_command']}_{rule['yamaha_channel']}_{rule['yamaha_mix']}"
    return f"vmix_{rule.get('vmix_function')}_{rule.get('vmix_target_input')}"


class GroupDuckEngine:
    def __init__(self):
        self._cache_ts: float = 0.0
        self._cache_ttl = 2.0
        self._channel_index: Dict[int, List[tuple]] = {}
        self._member_rt: Dict[int, Dict[str, Any]] = {}
        self._target_rt: Dict[str, Dict[str, Any]] = {}

    def clear(self):
        for t in self._target_rt.values():
            task = t.get("restore_task")
            if task and not task.done():
                task.cancel()
        self._channel_index.clear()
        self._member_rt.clear()
        self._target_rt.clear()
        self._cache_ts = 0.0

    async def reload_cache(self):
        self._channel_index.clear()
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(TriggerRule).where(
                        TriggerRule.is_active == True,
                        TriggerRule.listen_source == "yamaha",
                        TriggerRule.trigger_event == "YamahaMeter",
                        TriggerRule.is_multi_duck == True,
                    )
                )
                rules = result.scalars().all()
        except Exception as e:
            logger.error(f"[GROUP DUCK] Failed to load multi-duck rules: {e}")
            self._cache_ts = time.time()
            return

        for rule in rules:
            try:
                members_raw = json.loads(rule.duck_members or "[]")
            except json.JSONDecodeError:
                logger.warning(f"[GROUP DUCK] Invalid duck_members JSON on rule {rule.id}")
                continue

            fade_attack, fade_release = _parse_rule_fade(rule.parameter_value)

            gdict = {
                "id": rule.id,
                "name": rule.name,
                "silence_timeout_ms": rule.silence_timeout_ms or 3000,
                "fade_attack_ms": fade_attack,
                "fade_release_ms": fade_release,
            }

            for idx, m in enumerate(members_raw):
                if not m.get("monitor_channel"):
                    continue
                mid = rule.id * 1000 + idx
                mdict = {
                    "id": mid,
                    "member_index": idx,
                    "group_id": rule.id,
                    "monitor_channel": int(m["monitor_channel"]),
                    "threshold": m.get("threshold", -4000),
                    "release_threshold": m.get("release_threshold", -5000),
                    "action": member_to_action_dict(
                        m, mid, rule.id, fade_attack, fade_release
                    ),
                }
                ch = mdict["monitor_channel"]
                self._channel_index.setdefault(ch, []).append((gdict, mdict))

        self._cache_ts = time.time()
        logger.info(f"[MULTI-DUCK] Loaded channels: {sorted(self._channel_index.keys())}")

    async def _ensure_cache(self):
        if self._cache_ts > 0 and (time.time() - self._cache_ts) < self._cache_ttl:
            return
        await self.reload_cache()

    def _get_member_rt(self, member_id: int, group_id: int) -> Dict[str, Any]:
        if member_id not in self._member_rt:
            self._member_rt[member_id] = {
                "group_id": group_id,
                "last_speech_time": 0.0,
                "speaking": False,
            }
        return self._member_rt[member_id]

    def _get_target_rt(self, target_key: str) -> Dict[str, Any]:
        if target_key not in self._target_rt:
            self._target_rt[target_key] = {
                "contributors": set(),
                "members": {},
                "saved_value": None,
                "status": "idle",
                "restore_task": None,
                "rule": None,
                "lock": asyncio.Lock(),
            }
        return self._target_rt[target_key]

    def get_monitored_channels(self) -> Set[int]:
        return set(self._channel_index.keys())

    async def handle_meter(self, ch_index: int, level: int, engine) -> None:
        try:
            await self._ensure_cache()
        except Exception as e:
            logger.error(f"[GROUP DUCK] Cache error: {e}")
            return

        entries = self._channel_index.get(ch_index, [])
        if not entries:
            return

        now = time.time()
        for gdict, mdict in entries:
            try:
                await self._process_member_meter(gdict, mdict, level, now, engine)
            except Exception as e:
                logger.error(f"[GROUP DUCK] Meter processing error: {e}")

    async def _process_member_meter(
        self, gdict: Dict, mdict: Dict, level: int, now: float, engine
    ) -> None:
        member_id = mdict["id"]
        group_id = gdict["id"]
        rt = self._get_member_rt(member_id, group_id)
        action_rule = mdict["action"]

        threshold = mdict["threshold"]
        release_threshold = mdict["release_threshold"]
        silence_ms = gdict["silence_timeout_ms"]
        was_speaking = rt["speaking"]

        if level >= threshold:
            rt["last_speech_time"] = now
            if not was_speaking:
                rt["speaking"] = True
                await self._member_start_speaking(gdict, mdict, action_rule, engine)
            else:
                await self._cancel_target_restore(action_rule)
        elif level >= release_threshold:
            rt["last_speech_time"] = now
        elif was_speaking:
            elapsed_ms = (now - rt["last_speech_time"]) * 1000.0
            if elapsed_ms >= silence_ms:
                rt["speaking"] = False
                await self._member_stop_speaking(gdict, mdict, action_rule, engine)

    async def _member_start_speaking(
        self, gdict: Dict, mdict: Dict, action_rule: Dict, engine
    ) -> None:
        member_id = mdict["id"]
        target_key = make_target_key(action_rule)
        target = self._get_target_rt(target_key)
        was_restoring = await self._cancel_target_restore(action_rule)

        if member_id in target["contributors"]:
            return

        target["contributors"].add(member_id)
        target["members"][member_id] = mdict
        target["rule"] = action_rule

        if target["status"] == "idle" or was_restoring:
            target["status"] = "attacking"
            await self._broadcast_member_state(
                engine, gdict, mdict, action_rule, "applying", target_key=target_key
            )
            asyncio.create_task(
                self._duck_target(
                    target_key,
                    action_rule,
                    engine,
                    gdict,
                    mdict,
                    capture_snapshot=not was_restoring,
                )
            )
        else:
            await self._broadcast_member_state(
                engine,
                gdict,
                mdict,
                action_rule,
                "applied",
                value=_duck_action_value(action_rule),
                saved_value=target.get("saved_value"),
                target_key=target_key,
            )

    async def _member_stop_speaking(
        self, gdict: Dict, mdict: Dict, action_rule: Dict, engine
    ) -> None:
        member_id = mdict["id"]
        target_key = make_target_key(action_rule)
        target = self._target_rt.get(target_key)
        if not target:
            return

        target["contributors"].discard(member_id)
        if target["contributors"]:
            await self._broadcast_member_state(
                engine, gdict, mdict, action_rule, "held", target_key=target_key
            )
            return

        if target["status"] != "active":
            return

        if target.get("restore_task") and not target["restore_task"].done():
            return

        rule = target.get("rule")
        if not rule:
            return

        target["status"] = "restoring"
        await self._broadcast_target_members(
            engine, gdict, target, rule, "restoring", target_key=target_key
        )
        target["restore_task"] = asyncio.create_task(
            self._restore_target(target_key, rule, engine, gdict)
        )

    async def _cancel_target_restore(self, action_rule: Dict) -> bool:
        target_key = make_target_key(action_rule)
        target = self._target_rt.get(target_key)
        if not target:
            return False

        was_restoring = target["status"] == "restoring"
        task = target.get("restore_task")
        if task and not task.done():
            task.cancel()
            target["restore_task"] = None
        if was_restoring:
            target["status"] = "active"
        return was_restoring

    async def _duck_target(
        self,
        target_key: str,
        rule: Dict,
        engine,
        gdict: Dict,
        mdict: Dict,
        capture_snapshot: bool = True,
    ) -> None:
        target = self._target_rt[target_key]
        try:
            async with target["lock"]:
                saved = target.get("saved_value")
                if capture_snapshot:
                    saved = await engine._capture_action_value(rule)
                    if saved is None:
                        target["saved_value"] = None
                        await engine._add_log(
                            "WARNING",
                            f"Multi-duck: could not read state for {target_key}; applying without restore snapshot",
                            {"rule_id": gdict["id"]},
                        )
                    else:
                        target["saved_value"] = saved

                duck_val = _duck_action_value(rule)
                await engine._apply_meter_action(
                    rule,
                    duck_val,
                    is_restore=False,
                    saved_start=saved if capture_snapshot else None,
                )
                asyncio.create_task(engine._broadcast_trigger(gdict["id"]))
                asyncio.create_task(engine._record_fire(gdict["id"]))
                target["status"] = "active"
                await self._broadcast_member_state(
                    engine,
                    gdict,
                    mdict,
                    rule,
                    "applied",
                    value=duck_val,
                    saved_value=target.get("saved_value"),
                    target_key=target_key,
                )
                await engine._add_log(
                    "INFO",
                    f"'{gdict['name']}' mic Ch{mdict['monitor_channel']} -> duck {target_key}",
                    {"rule_id": gdict["id"]},
                )
        except asyncio.CancelledError:
            if target["status"] == "attacking":
                target["status"] = "idle"
            raise
        except Exception as e:
            logger.error(f"Multi-duck failed for {target_key}: {e}")
            target["status"] = "idle"
            await self._broadcast_member_state(
                engine, gdict, mdict, rule, "error", target_key=target_key
            )

    async def _restore_target(
        self, target_key: str, rule: Dict, engine, gdict: Dict
    ) -> None:
        target = self._target_rt[target_key]
        try:
            async with target["lock"]:
                saved = target.get("saved_value")
                if saved is None:
                    target["status"] = "idle"
                    target["restore_task"] = None
                    await self._broadcast_target_members(
                        engine, gdict, target, rule, "restored", target_key=target_key
                    )
                    target["members"].clear()
                    return

                restore_rule = _restore_rule_for_action(rule)
                await engine._apply_meter_action(restore_rule, saved, is_restore=True)
                target["saved_value"] = None
                target["status"] = "idle"
                target["restore_task"] = None
                await self._broadcast_target_members(
                    engine,
                    gdict,
                    target,
                    rule,
                    "restored",
                    restored_value=saved,
                    target_key=target_key,
                )
                target["members"].clear()
                await engine._add_log(
                    "INFO",
                    f"'{gdict['name']}' restored {target_key} -> {saved}",
                    {"rule_id": gdict["id"]},
                )
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Multi-duck restore failed for {target_key}: {e}")
            target["status"] = "active"

    async def _broadcast_target_members(
        self,
        engine,
        gdict: Dict,
        target: Dict,
        rule: Dict,
        status: str,
        value: Any = None,
        saved_value: Any = None,
        restored_value: Any = None,
        target_key: str = "",
    ) -> None:
        for mdict in list(target.get("members", {}).values()):
            await self._broadcast_member_state(
                engine,
                gdict,
                mdict,
                rule,
                status,
                value=value,
                saved_value=saved_value,
                restored_value=restored_value,
                target_key=target_key,
            )

    async def _broadcast_member_state(
        self,
        engine,
        gdict: Dict,
        mdict: Dict,
        rule: Dict,
        status: str,
        value: Any = None,
        saved_value: Any = None,
        restored_value: Any = None,
        target_key: str = "",
    ) -> None:
        if not hasattr(engine, "_broadcast_action_state"):
            return
        await engine._broadcast_action_state(
            {
                "rule_id": gdict["id"],
                "member_id": mdict["id"],
                "member_index": mdict.get("member_index"),
                "monitor_channel": mdict.get("monitor_channel"),
                "status": status,
                "action_target": rule.get("action_target"),
                "yamaha_command": rule.get("yamaha_command"),
                "yamaha_channel": rule.get("yamaha_channel"),
                "yamaha_mix": rule.get("yamaha_mix"),
                "vmix_function": rule.get("vmix_function"),
                "vmix_target_input": rule.get("vmix_target_input"),
                "value": value,
                "saved_value": saved_value,
                "restored_value": restored_value,
                "target_key": target_key or make_target_key(rule),
            }
        )


group_duck_engine = GroupDuckEngine()
