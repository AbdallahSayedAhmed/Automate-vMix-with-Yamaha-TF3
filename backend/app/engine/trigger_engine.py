import asyncio
import json
import logging
import time
from collections import deque
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set, Tuple

from sqlalchemy.future import select

import app.db.crud as crud
from app.db.database import AsyncSessionLocal
from app.db.models import ActivityLog, TriggerRule

logger = logging.getLogger(__name__)


class TriggerEngine:
    def __init__(self, log_capacity: int = 100):
        self.log_capacity = log_capacity
        self.execution_log: deque = deque(maxlen=log_capacity)
        self.callbacks: List[Callable[[Dict[str, Any]], Awaitable[None]]] = []
        self.vmix_input_callbacks: List[Callable[[Dict[str, Any]], Awaitable[None]]] = []

        self.vmix_connected = False
        self.yamaha_connected = False

        self.active_rules: List[Dict[str, Any]] = []

        self._last_audio_state: Dict[int, bool] = {}
        self._last_vmix_input_signature: Optional[Tuple[Tuple[str, ...], ...]] = None
        self._poller_task: Optional[asyncio.Task] = None

        self._last_rule_execution: Dict[int, float] = {}

        # Track if TimeRemaining has fired for a video to prevent spamming
        self._time_triggered_state: Dict[str, bool] = {}

        # Ducking State for Yamaha Meters
        self._ducking_state: Dict[int, Dict[str, Any]] = {}

        # Collision Detection: { target_key: (timestamp, priority_sort_order) }
        self._fader_locks: Dict[str, tuple[float, int]] = {}

        self._meter_log_count = 0  # Limit verbose meter logging

        # ── FIX #2 — TransitionIn/Out loop filter ────────────────────────────
        # Keep a live snapshot of vMix program/preview state so we can ignore
        # TransitionIn/Out events that come from a looping video restarting
        # rather than from an actual cut/transition.
        #
        # _vmix_program_inputs  : set of input numbers currently in Program output
        # _vmix_preview_inputs  : set of input numbers currently in Preview output
        # _vmix_program_keys    : set of input keys currently in Program output
        # _vmix_transition_guard: { input_number: timestamp }
        #   A TransitionIn caused by a looping video restarting looks exactly the
        #   same on the TCP stream but the XML shows the input was ALREADY in Program
        #   — so the guard window will still be active from the original transition.
        self._vmix_program_inputs: Set[int] = set()
        self._vmix_program_keys: Set[str] = set()
        self._vmix_preview_inputs: Set[int] = set()
        self._vmix_transition_guard: Dict[int, float] = {}

        # ── FIX #3 — live input name→number map ──────────────────────────────
        # Updated by the XML poller every 0.3 s.  Used in _process_match to
        # resolve rules whose vmix_input_name is set so the rule follows the
        # input by name even if its number changes in vMix.
        self._vmix_input_name_map: Dict[str, int] = {}   # title → number
        self._vmix_input_key_map: Dict[str, int] = {}    # key → number
        self._vmix_input_number_map: Dict[int, str] = {}  # number → title
        self._vmix_input_number_to_key_map: Dict[int, str] = {} # number → key

    # ── Rule loading ─────────────────────────────────────────────────────────

    async def reload_rules(self):
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(TriggerRule).where(TriggerRule.is_active == True)
            )
            rules_raw = result.scalars().all()
            self.active_rules = [self._rule_to_dict(r) for r in rules_raw]
            logger.info(
                f"Loaded {len(self.active_rules)} active trigger rules into engine memory."
            )

    # ── XML Poller ───────────────────────────────────────────────────────────

    def start_xml_poller(self, host: str, port: int):
        if not self._poller_task:
            print(f"   [*] Starting XML Audio Poller -> http://{host}:{port}/api/")
            self._poller_task = asyncio.create_task(self._xml_poll_loop(host, port))

    async def _xml_poll_loop(self, host: str, port: int):
        import httpx
        import xml.etree.ElementTree as ET

        url = f"http://{host}:{port}/api/"
        _logged_first_success = False
        _logged_first_error = False

        await asyncio.sleep(3.0)

        while True:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, timeout=2.0)
                    if resp.status_code == 200:
                        if not _logged_first_success:
                            logger.info(
                                "XML Audio Poller: Successfully connected to vMix HTTP API"
                            )
                            await self._add_log(
                                "INFO", f"Audio Poller connected to vMix at {url}"
                            )
                            _logged_first_success = True
                            _logged_first_error = False

                        root = ET.fromstring(resp.content)
                        inputs_elem = root.find("inputs")
                        input_elements = (
                            inputs_elem.findall("input")
                            if inputs_elem is not None
                            else []
                        )

                        # FIX #3 — keep name↔number maps fresh
                        self._refresh_input_maps(input_elements)

                        await self._check_vmix_input_changes(input_elements)

                        # FIX #2 — update program/preview sets from XML
                        self._refresh_program_preview(root)

                        for input_elem in input_elements:
                            input_number = int(input_elem.get("number"))
                            is_muted = input_elem.get("muted") == "True"

                            last_muted = self._last_audio_state.get(input_number)
                            if last_muted is not None and last_muted != is_muted:
                                event_name = "AudioOff" if is_muted else "AudioOn"
                                logger.info(
                                    f"XML Poller detected: {event_name} on Input {input_number}"
                                )
                                await self._add_log(
                                    "INFO",
                                    f"Audio {event_name} detected on Input {input_number}",
                                )
                                await self._process_match(
                                    "vmix", event_name, input_number
                                )

                            self._last_audio_state[input_number] = is_muted

                            # Time Remaining Logic
                            state = input_elem.get("state")
                            duration = int(input_elem.get("duration", "0"))
                            position = int(input_elem.get("position", "0"))

                            if state == "Running" and duration > 0 and position > 0:
                                time_remaining_ms = duration - position
                                await self._evaluate_time_remaining(
                                    input_number, time_remaining_ms
                                )
                            elif position < 1000 or state != "Running":
                                self._reset_time_trigger(input_number)

            except Exception as e:
                if not _logged_first_error:
                    logger.warning(f"XML Audio Poller error: {e}")
                    await self._add_log(
                        "WARNING",
                        f"Audio Poller cannot reach vMix HTTP API at {url}: {e}",
                    )
                    _logged_first_error = True
                    _logged_first_success = False

            await asyncio.sleep(0.3)

    # ── FIX #3 — input name/number map helpers ───────────────────────────────

    def _refresh_input_maps(self, input_elements) -> None:
        """Rebuild name↔number lookup tables from the current XML snapshot."""
        name_map: Dict[str, int] = {}
        key_map: Dict[str, int] = {}
        number_map: Dict[int, str] = {}
        number_to_key_map: Dict[int, str] = {}
        for elem in input_elements:
            try:
                num = int(elem.get("number", 0))
                title = (elem.get("title") or "").strip()
                key = (elem.get("key") or "").strip()
                if num:
                    if title:
                        name_map[title] = num
                        number_map[num] = title
                    if key:
                        key_map[key] = num
                        number_to_key_map[num] = key
            except (ValueError, TypeError):
                pass
        self._vmix_input_name_map = name_map
        self._vmix_input_key_map = key_map
        self._vmix_input_number_map = number_map
        self._vmix_input_number_to_key_map = number_to_key_map

    def _resolve_rule_input_number(self, rule: Dict[str, Any]) -> Optional[int]:
        """
        FIX #3 — Return the CURRENT input number for a rule.

        Priority:
          1. Lookup by UUID key (immune to both reorder and rename)
          2. Lookup by title (survives reorder, breaks on rename)
          3. Fallback to static stored number
        """
        key = (rule.get("vmix_input_key") or "").strip()
        if key:
            resolved_key = self._vmix_input_key_map.get(key)
            if resolved_key is not None:
                return resolved_key

        name = (rule.get("vmix_input_name") or "").strip()
        if name:
            resolved_name = self._vmix_input_name_map.get(name)
            if resolved_name is not None:
                return resolved_name
            return -1  # Name not found in current vMix state — input may be offline/renamed.
            
        return rule.get("vmix_input_number")

    # ── FIX #2 — program/preview state helpers ───────────────────────────────

    def _refresh_program_preview(self, root) -> None:
        """
        Parse <vmix> root to find which inputs are in Program and Preview.
        vMix XML exposes <active> (program) and <preview> as direct children
        with the input number as text.  Multiple overlays are in <overlay>.
        
        FIX #2 — Fire TransitionIn and TransitionOut based on XML diffs to 
        completely ignore false-positive transitions from looping videos.
        """
        new_program: Set[int] = set()
        new_program_keys: Set[str] = set()
        new_preview: Set[int] = set()

        active_elem = root.find("active")
        if active_elem is not None and active_elem.text:
            try:
                num = int(active_elem.text.strip())
                new_program.add(num)
                key = self._vmix_input_number_to_key_map.get(num)
                if key: new_program_keys.add(key)
            except ValueError:
                pass

        preview_elem = root.find("preview")
        if preview_elem is not None and preview_elem.text:
            try:
                new_preview.add(int(preview_elem.text.strip()))
            except ValueError:
                pass

        # Overlays also count as "in program"
        for ov in root.findall("overlay"):
            if ov.text:
                try:
                    num = int(ov.text.strip())
                    new_program.add(num)
                    key = self._vmix_input_number_to_key_map.get(num)
                    if key: new_program_keys.add(key)
                except ValueError:
                    pass

        # Diff for genuine transitions using UUID keys to survive reordering
        just_in_keys = new_program_keys - self._vmix_program_keys
        just_out_keys = self._vmix_program_keys - new_program_keys

        self._vmix_program_inputs = new_program
        self._vmix_program_keys = new_program_keys
        self._vmix_preview_inputs = new_preview

        # Fire transition events via create_task so we don't block the poller
        for key in just_in_keys:
            input_num = self._vmix_input_key_map.get(key)
            if input_num:
                asyncio.create_task(self._process_match("vmix", "TransitionIn", input_num))
        
        for key in just_out_keys:
            # For TransitionOut, the input might have just been deleted, so it might not be in key_map.
            # But if it's just a normal transition, it is in key_map.
            input_num = self._vmix_input_key_map.get(key)
            if input_num:
                asyncio.create_task(self._process_match("vmix", "TransitionOut", input_num))


    # ── Time-remaining helpers ────────────────────────────────────────────────

    def _reset_time_trigger(self, input_number: int):
        keys_to_remove = [
            k
            for k in self._time_triggered_state.keys()
            if k.endswith(f"_{input_number}")
        ]
        for k in keys_to_remove:
            del self._time_triggered_state[k]

    async def _evaluate_time_remaining(
        self, input_number: int, time_remaining_ms: int
    ):
        rules = [
            r
            for r in self.active_rules
            if r.get("listen_source") == "vmix"
            and r.get("trigger_event") == "TimeRemaining"
        ]

        for rule in rules:
            resolved = self._resolve_rule_input_number(rule)
            if resolved is not None and resolved != input_number:
                continue

            trigger_key = f"{rule['id']}_{input_number}"
            if self._time_triggered_state.get(trigger_key):
                continue

            time_str = rule.get("time_threshold")
            if not time_str:
                continue

            try:
                parts = time_str.split(":")
                if len(parts) == 3:
                    h, m, s = map(int, parts)
                    threshold_ms = (h * 3600 + m * 60 + s) * 1000
                elif len(parts) == 2:
                    m, s = map(int, parts)
                    threshold_ms = (m * 60 + s) * 1000
                else:
                    threshold_ms = int(parts[0]) * 1000
            except ValueError:
                continue

            if time_remaining_ms <= threshold_ms:
                self._time_triggered_state[trigger_key] = True
                msg = f"TimeRemaining Threshold ({time_str}) reached on Input {input_number}"
                logger.info(msg)
                await self._add_log("INFO", msg, {"rule_id": rule["id"]})
                asyncio.create_task(self._execute_rule_delayed(rule))

    # ── Callbacks ────────────────────────────────────────────────────────────

    def add_log_callback(self, cb: Callable[[Dict[str, Any]], Awaitable[None]]):
        self.callbacks.append(cb)

    def add_vmix_inputs_callback(
        self, cb: Callable[[Dict[str, Any]], Awaitable[None]]
    ):
        self.vmix_input_callbacks.append(cb)

    def _build_vmix_input_signature(
        self, input_elements
    ) -> Tuple[Tuple[str, ...], ...]:
        return tuple(
            (
                input_elem.get("number", ""),
                input_elem.get("key", ""),
                input_elem.get("type", ""),
                input_elem.get("title", ""),
                input_elem.get("shortTitle", ""),
            )
            for input_elem in input_elements
        )

    async def _check_vmix_input_changes(self, input_elements):
        signature = self._build_vmix_input_signature(input_elements)
        if self._last_vmix_input_signature is None:
            self._last_vmix_input_signature = signature
            return

        if signature == self._last_vmix_input_signature:
            return

        self._last_vmix_input_signature = signature
        await self._notify_vmix_inputs_changed({"count": len(input_elements)})

    async def _notify_vmix_inputs_changed(self, payload: Dict[str, Any]):
        for cb in self.vmix_input_callbacks:
            try:
                await cb(payload)
            except Exception as e:
                logger.error(f"Error in vMix input change callback: {e}")

    # ── Logging ──────────────────────────────────────────────────────────────

    async def _add_log(
        self, level: str, message: str, meta: Optional[Dict[str, Any]] = None
    ):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": level,
            "message": message,
            "meta": meta or {},
        }
        self.execution_log.append(log_entry)
        logger.info(f"[{level}] {message}")
        for cb in self.callbacks:
            try:
                await cb(log_entry)
            except Exception as e:
                logger.error(f"Error in engine callback: {e}")

        if meta and meta.get("rule_id"):
            asyncio.create_task(self._save_log_to_db(level, message, meta))

    async def _save_log_to_db(self, level: str, message: str, meta: Dict[str, Any]):
        try:
            from app.schemas.trigger import ActivityLogCreate

            log_data = ActivityLogCreate(
                rule_id=meta.get("rule_id"),
                rule_name=meta.get("rule_name") or "Unknown Rule",
                event_source=meta.get("event_source", "unknown"),
                event_details=meta.get("event_details", message),
                action_target=meta.get("action_target", "unknown"),
                action_details=meta.get("action_details", message),
                level=level,
            )
            async with AsyncSessionLocal() as db:
                await crud.create_activity_log(db, log_data)
        except Exception as e:
            logger.error(f"Failed to save activity log to db: {e}")

    # ── Connection status ─────────────────────────────────────────────────────

    async def handle_vmix_status(self, is_connected: bool):
        self.vmix_connected = is_connected
        if is_connected:
            self._last_vmix_input_signature = None
            await self._notify_vmix_inputs_changed({"reason": "reconnect"})
        await self._add_log(
            "INFO",
            f"vMix TCP Connection {'Established' if is_connected else 'Lost'}",
        )

    async def handle_yamaha_status(self, is_connected: bool):
        self.yamaha_connected = is_connected
        await self._add_log(
            "INFO",
            f"Yamaha TF3 Connection {'Established' if is_connected else 'Lost'}",
        )

    # ── vMix TCP event ingestion ──────────────────────────────────────────────

    async def ingest_vmix_event(self, raw_event: str):
        """
        Parse a raw line from the vMix TCP socket and dispatch to _process_match.

        FIX #2 — TransitionIn and TransitionOut are now filtered through
        _refresh_program_preview (XML diffing) so looping videos that restart internally
        do not fire transition rules again.
        """
        parts = raw_event.split()
        if not parts:
            return

        if parts[0] == "ACTS" and len(parts) >= 5 and parts[1] == "OK":
            activator = parts[2]
            try:
                input_number = int(parts[3])
                value = parts[4]
                event_names = []

                if activator == "Input":
                    # TransitionIn and TransitionOut are handled securely by
                    # _refresh_program_preview (XML diffing).
                    pass

                elif activator == "Preview":
                    event_names.append("InputPreview")

                elif activator == "InputPlaying":
                    # InputPlaying fires for play/pause inside an input, not
                    # for program transitions — keep the existing behaviour but
                    # still guard against loops here too.
                    if value == "1":
                        # VideoPlay always fires; TransitionIn only if genuine
                        event_names.append("VideoPlay")
                        if self._is_real_transition_in(input_number):
                            event_names.append("TransitionIn")
                    else:
                        event_names.append("VideoPause")
                        if self._is_real_transition_out(input_number):
                            event_names.append("TransitionOut")

                elif activator in ("Audio", "InputAudio", "AudioOn"):
                    event_names.append("AudioOn" if value == "1" else "AudioOff")

                elif activator.startswith("Overlay") and activator[-1].isdigit():
                    event_names.append("OverlayIn" if value == "1" else "OverlayOut")

                for event_name in event_names:
                    await self._process_match("vmix", event_name, input_number)

            except ValueError:
                pass

    # ── Yamaha meter state helpers ────────────────────────────────────────────

    def _get_meter_state(self, rule_id: int) -> Dict[str, Any]:
        if rule_id not in self._ducking_state:
            self._ducking_state[rule_id] = {
                "status": "idle",
                "last_speech_time": 0.0,
                "saved_value": None,
                "lock": asyncio.Lock(),
                "cycle_task": None,
            }
        return self._ducking_state[rule_id]

    def _yamaha_read_command(self, yamaha_command: str) -> str:
        if yamaha_command.endswith("/Smooth"):
            return yamaha_command.replace("/Smooth", "/Level")
        return yamaha_command

    def _yamaha_level_command(self, yamaha_command: str) -> str:
        return self._yamaha_read_command(yamaha_command)

    def _is_yamaha_level_command(self, yamaha_command: str) -> bool:
        return yamaha_command.endswith("/Level") or yamaha_command.endswith("/Smooth")

    def _smooth_duration_ms(self, rule: Dict[str, Any]) -> int:
        parts = str(rule.get("parameter_value", "")).split(",")
        if len(parts) >= 2:
            try:
                return int(parts[-1])
            except ValueError:
                pass
        return 1000

    async def _cancel_yamaha_fade(self, rule: Dict[str, Any]):
        from app.drivers import yamaha_tcp

        cmd = rule.get("yamaha_command", "")
        if cmd.endswith("/Smooth") or cmd.endswith("/Level"):
            base = self._yamaha_level_command(cmd) if cmd.endswith("/Smooth") else cmd
            yamaha_tcp.cancel_fade(base, rule["yamaha_channel"], rule["yamaha_mix"])
            await asyncio.sleep(0.02)

    async def _capture_action_value_once(self, rule: Dict[str, Any]) -> Optional[Any]:
        import httpx
        import xml.etree.ElementTree as etree

        from app.core.config import settings
        from app.drivers import yamaha_tcp

        try:
            if rule["action_target"] == "yamaha":
                cmd = self._yamaha_read_command(rule["yamaha_command"])
                await self._cancel_yamaha_fade(rule)
                return await yamaha_tcp.request_value(
                    cmd, rule["yamaha_channel"], rule["yamaha_mix"], timeout=2.0
                )
            if rule["action_target"] == "vmix":
                url = f"http://{settings.vmix_host}:{settings.vmix_http_port}/api/"
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, timeout=2.0)
                    if resp.status_code != 200:
                        return None
                    root = etree.fromstring(resp.content)
                    func = rule.get("vmix_function") or ""
                    if func == "SetVolume" and rule.get("vmix_target_input"):
                        elem = root.find(
                            f".//input[@number='{rule['vmix_target_input']}']"
                        )
                        return elem.get("volume") if elem is not None else None
                    if func == "SetMasterVolume":
                        elem = root.find(".//audio/master")
                        return elem.get("volume") if elem is not None else None
                    if func.startswith("SetBus") and func.endswith("Volume"):
                        bus_letter = func.replace("SetBus", "").replace("Volume", "")
                        elem = root.find(f".//audio/bus{bus_letter}")
                        return elem.get("volume") if elem is not None else None
        except Exception as e:
            logger.warning(
                f"Failed to capture current value for rule {rule.get('id')}: {e}"
            )
        return None

    async def _capture_action_value(self, rule: Dict[str, Any]) -> Optional[Any]:
        for attempt in range(3):
            value = await self._capture_action_value_once(rule)
            if value is not None:
                return value
            await asyncio.sleep(0.08 * (attempt + 1))
        return None

    # ── Action list helpers ───────────────────────────────────────────────────

    def _parse_actions(self, raw_actions: Any) -> List[Dict[str, Any]]:
        if not raw_actions:
            return []
        if isinstance(raw_actions, list):
            return [a for a in raw_actions if isinstance(a, dict)]
        if isinstance(raw_actions, str):
            try:
                parsed = json.loads(raw_actions)
            except (TypeError, json.JSONDecodeError):
                return []
            return (
                [a for a in parsed if isinstance(a, dict)]
                if isinstance(parsed, list)
                else []
            )
        return []

    def _action_to_rule(
        self, rule: Dict[str, Any], action: Dict[str, Any], index: int = 0
    ) -> Dict[str, Any]:
        return {
            **rule,
            "action_target": action.get(
                "action_target", rule.get("action_target", "yamaha")
            ),
            "yamaha_command": action.get(
                "yamaha_command", rule.get("yamaha_command", "InCh/Fader/Level")
            ),
            "yamaha_channel": action.get(
                "yamaha_channel", rule.get("yamaha_channel", 1)
            ),
            "yamaha_mix": action.get("yamaha_mix", rule.get("yamaha_mix", 0)),
            "vmix_function": action.get("vmix_function", rule.get("vmix_function")),
            "vmix_target_input": action.get(
                "vmix_target_input", rule.get("vmix_target_input")
            ),
            "parameter_value": str(
                action.get("parameter_value", rule.get("parameter_value", "0"))
            ),
            "delay_ms": action.get("delay_ms", 0),
            "_action_index": index,
        }

    def _rule_action_list(self, rule: Dict[str, Any]) -> List[Dict[str, Any]]:
        parsed = self._parse_actions(rule.get("actions"))
        if parsed:
            return [
                self._action_to_rule(rule, action, i)
                for i, action in enumerate(parsed)
            ]
        return [{**rule, "_action_index": None}]

    # ── Yamaha meter handler ──────────────────────────────────────────────────

    async def handle_yamaha_meter(self, ch_index: int, level: int):
        """Called by Yamaha meter stream with (channel_1based, level in centidB)."""
        asyncio.create_task(self._broadcast_meter(ch_index, level))

        from app.engine.group_duck_engine import group_duck_engine

        try:
            await group_duck_engine.handle_meter(ch_index, level, self)
        except Exception as e:
            logger.error(f"[ENGINE] Multi-duck meter handler error: {e}")

        self._meter_log_count += 1
        if self._meter_log_count <= 10:
            logger.info(
                f"[ENGINE] handle_yamaha_meter called: ch={ch_index}, level={level}"
            )
            if self._meter_log_count == 10:
                logger.info(
                    "[ENGINE] Suppressing further meter debug logs (working correctly)"
                )

        rules = [
            r
            for r in self.active_rules
            if r.get("listen_source") == "yamaha"
            and r.get("trigger_event") == "YamahaMeter"
            and not r.get("is_multi_duck")
            and r.get("vmix_input_number") == ch_index
        ]

        now = time.time()
        for rule in rules:
            state = self._get_meter_state(rule["id"])
            threshold = rule.get("threshold") or -4000
            release_threshold = rule.get("release_threshold")
            if release_threshold is None:
                release_threshold = threshold - 1000
            silence_timeout = rule.get("silence_timeout_ms") or 3000

            if level >= threshold:
                state["last_speech_time"] = now
                if state["status"] == "restoring":
                    self._cancel_meter_cycle(state)
                    state["status"] = "active"
                    asyncio.create_task(self._resume_duck_after_interrupt(rule, state))
                elif state["status"] == "idle":
                    state["status"] = "attacking"
                    self._start_meter_cycle(
                        rule, state, self._duck_and_save(rule, state)
                    )
            elif level >= release_threshold:
                state["last_speech_time"] = now
            elif state["status"] == "active":
                if (now - state["last_speech_time"]) * 1000.0 >= silence_timeout:
                    if state.get("saved_value") is not None:
                        state["status"] = "restoring"
                        self._start_meter_cycle(
                            rule, state, self._restore_value(rule, state)
                        )
                    else:
                        state["status"] = "idle"

    def _start_meter_cycle(self, rule: Dict[str, Any], state: Dict[str, Any], coro):
        self._cancel_meter_cycle(state)
        state["cycle_task"] = asyncio.create_task(coro)

    def _cancel_meter_cycle(self, state: Dict[str, Any]):
        task = state.get("cycle_task")
        if task and not task.done():
            task.cancel()
        state["cycle_task"] = None

    async def _broadcast_meter(self, ch_index: int, level: int):
        from app.api.websocket import ws_manager

        await ws_manager.broadcast_meter(ch_index, level)

    async def _broadcast_rule_action_status(
        self, rule: Dict[str, Any], action_rule: Dict[str, Any], status: str, **extra
    ):
        idx = action_rule.get("_action_index")
        if idx is None:
            return
        await self._broadcast_action_state(
            {
                "rule_id": rule["id"],
                "action_index": idx,
                "status": status,
                "action_target": action_rule.get("action_target"),
                "yamaha_command": action_rule.get("yamaha_command"),
                "yamaha_channel": action_rule.get("yamaha_channel"),
                "yamaha_mix": action_rule.get("yamaha_mix"),
                "vmix_function": action_rule.get("vmix_function"),
                "vmix_target_input": action_rule.get("vmix_target_input"),
                **extra,
            }
        )

    async def _apply_meter_action_item(
        self,
        rule: Dict[str, Any],
        action_rule: Dict[str, Any],
        value: Any,
        *,
        is_restore: bool = False,
        saved_start: Optional[Any] = None,
        honor_delay: bool = False,
    ):
        if honor_delay and action_rule.get("delay_ms", 0) > 0:
            await asyncio.sleep(action_rule["delay_ms"] / 1000.0)
        await self._broadcast_rule_action_status(
            rule, action_rule, "restoring" if is_restore else "applying", value=value
        )
        await self._apply_meter_action(
            action_rule, value, is_restore=is_restore, saved_start=saved_start
        )
        await self._broadcast_rule_action_status(
            rule,
            action_rule,
            "restored" if is_restore else "applied",
            value=value,
            restored_value=value if is_restore else None,
            saved_value=saved_start if not is_restore else None,
        )

    async def _resume_duck_after_interrupt(
        self, rule: Dict[str, Any], state: Dict[str, Any]
    ):
        from app.drivers import yamaha_tcp

        async with state["lock"]:
            action_rules = self._rule_action_list(rule)
            for action_rule in action_rules:
                if action_rule["action_target"] == "yamaha" and action_rule[
                    "yamaha_command"
                ].endswith("/Smooth"):
                    base_cmd = self._yamaha_level_command(action_rule["yamaha_command"])
                    yamaha_tcp.cancel_fade(
                        base_cmd,
                        action_rule["yamaha_channel"],
                        action_rule["yamaha_mix"],
                    )
            await asyncio.gather(
                *[
                    self._apply_meter_action_item(
                        rule,
                        action_rule,
                        action_rule.get("parameter_value", "0"),
                        is_restore=False,
                        honor_delay=False,
                    )
                    for action_rule in action_rules
                ]
            )
            await self._add_log(
                "INFO",
                f"Speech resumed on Ch {rule['vmix_input_number']} — ducking re-applied.",
                {"rule_id": rule["id"]},
            )

    async def _duck_and_save(self, rule: Dict[str, Any], state: Dict[str, Any]):
        try:
            async with state["lock"]:
                action_rules = self._rule_action_list(rule)
                await self._broadcast_listen_event(
                    source="yamaha",
                    event_name="YamahaMeter",
                    rule=rule,
                    listen_input=rule.get("vmix_input_number"),
                    listen_label=f"Mic Ch {rule.get('vmix_input_number') or '?'}",
                    action_rules=action_rules,
                )
                saved_items = []
                for action_rule in action_rules:
                    saved = await self._capture_action_value(action_rule)
                    if saved is None:
                        action_idx = action_rule.get("_action_index")
                        action_label = action_idx + 1 if action_idx is not None else 1
                        await self._add_log(
                            "WARNING",
                            f"Could not read current state for '{rule['name']}' action {action_label}; applying without restore snapshot.",
                            {"rule_id": rule["id"]},
                        )
                    saved_items.append({"rule": action_rule, "value": saved})

                state["saved_value"] = saved_items
                await asyncio.gather(
                    *[
                        self._apply_meter_action_item(
                            rule,
                            item["rule"],
                            item["rule"].get("parameter_value", "0"),
                            is_restore=False,
                            saved_start=item["value"],
                            honor_delay=True,
                        )
                        for item in saved_items
                    ]
                )
                asyncio.create_task(self._broadcast_trigger(rule["id"]))
                asyncio.create_task(self._record_fire(rule["id"]))
                state["status"] = "active"
                await self._add_log(
                    "INFO",
                    f"Mic active on Ch {rule['vmix_input_number']} — applied {len(action_rules)} action(s).",
                    {"rule_id": rule["id"]},
                )
        except asyncio.CancelledError:
            if state["status"] == "attacking":
                state["status"] = "idle"
            raise
        except Exception as e:
            logger.error(f"Duck cycle failed for rule {rule['id']}: {e}")
            state["status"] = "idle"
            state["saved_value"] = None

    async def _restore_value(self, rule: Dict[str, Any], state: Dict[str, Any]):
        try:
            async with state["lock"]:
                saved_items = state.get("saved_value")
                if saved_items is None:
                    state["status"] = "idle"
                    await self._add_log(
                        "WARNING",
                        f"No saved state to restore for rule '{rule['name']}'.",
                        {"rule_id": rule["id"]},
                    )
                    return

                if not isinstance(saved_items, list):
                    saved_items = [
                        {"rule": {**rule, "_action_index": None}, "value": saved_items}
                    ]

                restorable = [
                    item for item in saved_items if item.get("value") is not None
                ]
                if restorable:
                    await asyncio.gather(
                        *[
                            self._apply_meter_action_item(
                                rule,
                                item["rule"],
                                item["value"],
                                is_restore=True,
                                honor_delay=False,
                            )
                            for item in restorable
                        ]
                    )
                state["saved_value"] = None
                state["status"] = "idle"
                await self._add_log(
                    "INFO",
                    f"Silence on Ch {rule['vmix_input_number']} — restored {len(restorable)} action target(s).",
                    {"rule_id": rule["id"]},
                )
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Restore cycle failed for rule {rule['id']}: {e}")
            state["status"] = "active"

    async def _apply_meter_action(
        self,
        rule: Dict[str, Any],
        value: Any,
        is_restore: bool = False,
        saved_start: Optional[Any] = None,
    ):
        """Apply duck or restore for meter rules — all Yamaha + vMix volume/mute types.

        FIX #1 — When action_target == 'vmix', fall through to _execute_action
        which handles vMix HTTP calls.  Previously the vmix path was missing from
        this method entirely, causing every Yamaha-listen → vMix-command rule to
        silently no-op (status shown as 'error' in the UI).
        """
        from app.drivers import yamaha_tcp

        if rule["action_target"] == "yamaha":
            if not yamaha_tcp.connected:
                await self._add_log(
                    "WARNING",
                    f"Yamaha not connected — skipped meter action for '{rule['name']}'",
                    {"rule_id": rule["id"]},
                )
                return

            cmd = rule["yamaha_command"]
            ch, mix = rule["yamaha_channel"], rule["yamaha_mix"]

            if cmd.endswith("/Smooth"):
                base_cmd = self._yamaha_level_command(cmd)
                await self._cancel_yamaha_fade(rule)
                duration = self._smooth_duration_ms(rule)

                if is_restore:
                    end_val = int(value)
                    current_val = await yamaha_tcp.request_value(
                        base_cmd, ch, mix, timeout=2.0
                    )
                    if current_val is None:
                        current_val = end_val
                    await yamaha_tcp.fade_command(
                        base_cmd, ch, mix, current_val, end_val, duration
                    )
                    await yamaha_tcp.await_fade(base_cmd, ch, mix)
                    await self._add_log(
                        "SUCCESS",
                        f"Restored smooth: {base_cmd} → {end_val} over {duration}ms",
                        {"rule_id": rule["id"]},
                    )
                    return

                parts = str(value).split(",")
                if len(parts) == 3:
                    start_val, end_val, dur = (
                        int(parts[0]),
                        int(parts[1]),
                        int(parts[2]),
                    )
                elif len(parts) == 2:
                    end_val, dur = int(parts[0]), int(parts[1])
                    start_val = (
                        int(saved_start)
                        if saved_start is not None
                        else await yamaha_tcp.request_value(
                            base_cmd, ch, mix, timeout=2.0
                        )
                    )
                    if start_val is None:
                        start_val = 0
                else:
                    await yamaha_tcp.send_command(base_cmd, ch, str(value), mix)
                    await self._add_log(
                        "SUCCESS",
                        f"Meter duck: {cmd} val={value}",
                        {"rule_id": rule["id"]},
                    )
                    return

                await yamaha_tcp.fade_command(
                    base_cmd, ch, mix, start_val, end_val, dur
                )
                await self._add_log(
                    "SUCCESS",
                    f"Meter duck fade: {base_cmd} {start_val} → {end_val} over {dur}ms",
                    {"rule_id": rule["id"]},
                )
                return

            target = str(int(value)) if isinstance(value, (int, float)) else str(value)
            await yamaha_tcp.send_command(cmd, ch, target, mix)
            action = "Restored" if is_restore else "Applied"
            await self._add_log(
                "SUCCESS",
                f"{action} Yamaha: {cmd} ch={ch} mix={mix} val={target}",
                {"rule_id": rule["id"]},
            )
            return

        # FIX #1 — vMix action from a Yamaha-listen rule
        # Route through _execute_action which handles all vMix HTTP functions.
        ok = await self._execute_action(rule, str(value), skip_collision_check=True)
        if ok is False:
            await self._add_log(
                "ERROR",
                f"vMix action failed for Yamaha-triggered rule '{rule.get('name')}'",
                {"rule_id": rule.get("id")},
            )

    # ── Core match dispatcher ─────────────────────────────────────────────────

    async def _process_match(self, source: str, event_name: str, input_number: int):
        """
        Find all active rules that match (source, event_name, input_number) and
        schedule their execution.

        FIX #3 — Input matching now uses _resolve_rule_input_number() which
        looks up the rule's vmix_input_name in the live name→number map.  This
        means a rule saved as "Camera 1" always follows that input by name even
        if the operator reorders inputs inside vMix, changing its number.
        """
        matched_rules: List[Dict[str, Any]] = []
        for r in self.active_rules:
            if r.get("listen_source") != source:
                continue
            if r.get("trigger_event") != event_name:
                continue

            resolved = self._resolve_rule_input_number(r)

            if resolved is None:
                # "Any input" rule — always matches
                matched_rules.append(r)
            elif resolved == input_number:
                matched_rules.append(r)
            # else: resolved == -1 (name not found) or different number — skip

        now = time.time()
        for rule in matched_rules:
            last_exec = self._last_rule_execution.get(rule["id"], 0.0)
            if now - last_exec < 0.5:
                continue

            self._last_rule_execution[rule["id"]] = now

            # Build a human-readable label that shows the resolved name
            resolved = self._resolve_rule_input_number(rule)
            stored_name = (rule.get("vmix_input_name") or "").strip()
            if source == "vmix":
                if stored_name:
                    # Show "Camera 1 (Input 3)" so operator can see both
                    live_num = self._vmix_input_name_map.get(stored_name, resolved)
                    listen_label = f"{stored_name} (Input {live_num})"
                elif resolved:
                    listen_label = f"Input {resolved}"
                else:
                    listen_label = f"Any vMix Input (matched Input {input_number})"
            else:
                listen_label = None  # Yamaha labels built in _broadcast_listen_event

            msg = f"Matched rule '{rule['name']}' — {rule['trigger_event']} on {listen_label or f'Input {input_number}'}"
            logger.info(msg)
            asyncio.create_task(self._add_log("INFO", msg, {"rule_id": rule["id"]}))
            asyncio.create_task(
                self._broadcast_listen_event(
                    source=source,
                    event_name=event_name,
                    rule=rule,
                    listen_input=input_number,
                    listen_label=listen_label,
                    action_rules=self._rule_action_list(rule),
                )
            )

            asyncio.create_task(self._execute_rule_delayed(rule))

    # ── Rule serialisation ────────────────────────────────────────────────────

    def _rule_to_dict(self, r) -> Dict[str, Any]:
        return {
            "id": r.id,
            "name": r.name,
            "sort_order": r.sort_order,
            "listen_source": r.listen_source,
            "trigger_event": r.trigger_event,
            "vmix_input_number": r.vmix_input_number,
            "vmix_input_name": r.vmix_input_name,   # FIX #3 — include name
            "vmix_input_key": r.vmix_input_key,
            "threshold": r.threshold,
            "release_threshold": r.release_threshold,
            "silence_timeout_ms": r.silence_timeout_ms,
            "time_threshold": r.time_threshold,
            "is_multi_duck": r.is_multi_duck,
            "duck_members": r.duck_members,
            "is_multi_action": r.is_multi_action,
            "actions": r.actions,
            "action_target": r.action_target,
            "yamaha_command": r.yamaha_command,
            "yamaha_channel": r.yamaha_channel,
            "yamaha_mix": r.yamaha_mix,
            "vmix_function": r.vmix_function,
            "vmix_target_input": r.vmix_target_input,
            "vmix_target_input_key": getattr(r, "vmix_target_input_key", None),
            "parameter_value": r.parameter_value,
            "delay_ms": r.delay_ms,
        }

    # ── Broadcast helpers ─────────────────────────────────────────────────────

    async def _broadcast_trigger(self, rule_id: int):
        from app.api.websocket import ws_manager

        await ws_manager.broadcast_trigger(rule_id)

    async def _broadcast_action_state(self, payload: Dict[str, Any]):
        from app.api.websocket import ws_manager

        await ws_manager.broadcast_action_state(payload)

    def _vmix_uses_input_param(self, func: str) -> bool:
        if func == "SetVolume":
            return True
        if func.startswith("OverlayInput") and func != "OverlayInputAllOff":
            return True
        return func in {
            "PreviewInput",
            "Cut",
            "Fade",
            "Merge",
            "Wipe",
            "Slide",
            "Zoom",
            "Cube",
            "VerticalWipe",
        }

    def _vmix_value_only_function(self, func: str) -> bool:
        return func == "SetMasterVolume" or (
            func.startswith("SetBus") and func.endswith("Volume")
        )

    def _build_vmix_params(
        self, func: str, target_value: str, target_input: Optional[int]
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {"Function": func}
        clean_value = str(target_value or "").strip()

        if func == "OverlayInputAllOff":
            return params

        if self._vmix_uses_input_param(func):
            input_value = target_input if target_input is not None else clean_value
            if input_value not in (None, ""):
                params["Input"] = input_value
            if func == "SetVolume":
                params["Value"] = clean_value
            return params

        if self._vmix_value_only_function(func):
            params["Value"] = clean_value
            return params

        if target_input is not None:
            params["Input"] = target_input
        if clean_value:
            params["Value"] = clean_value
        return params

    def _action_summary(self, action_rule: Dict[str, Any]) -> str:
        value = action_rule.get("parameter_value", "")
        if action_rule.get("action_target") == "vmix":
            func = action_rule.get("vmix_function") or "SetVolume"
            target = action_rule.get("vmix_target_input")
            if self._vmix_uses_input_param(func) and func != "SetVolume":
                target_part = f"Input {target or value}"
                return f"vMix {func} → {target_part}"
            target_part = f" Input {target}" if target else ""
            return f"vMix {func}{target_part} → {value}"

        cmd = action_rule.get("yamaha_command") or "Yamaha"
        ch = action_rule.get("yamaha_channel")
        mix = action_rule.get("yamaha_mix")
        parts = [f"Yamaha {cmd}"]
        if ch:
            parts.append(f"Ch {ch}")
        if mix:
            parts.append(f"Mix {mix}")
        parts.append(f"→ {value}")
        return " ".join(parts)

    def _actions_summary(self, action_rules: List[Dict[str, Any]]) -> str:
        if not action_rules:
            return "No actions configured"
        summaries = [self._action_summary(action_rule) for action_rule in action_rules]
        if len(summaries) == 1:
            return summaries[0]
        shown = "; ".join(summaries[:3])
        suffix = "; …" if len(summaries) > 3 else ""
        return f"{len(summaries)} actions → {shown}{suffix}"

    async def _broadcast_listen_event(
        self,
        *,
        source: str,
        event_name: str,
        rule: Dict[str, Any],
        listen_input: Optional[int] = None,
        listen_label: Optional[str] = None,
        action_rules: Optional[List[Dict[str, Any]]] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        from app.api.websocket import ws_manager

        actions = (
            action_rules
            if action_rules is not None
            else self._rule_action_list(rule)
        )
        is_yamaha = source == "yamaha"
        label = listen_label
        if not label:
            if is_yamaha:
                label = (
                    f"Mic Ch {listen_input or rule.get('vmix_input_number') or '?'}"
                )
            elif rule.get("vmix_input_name"):
                stored_name = rule["vmix_input_name"]
                live_num = self._vmix_input_name_map.get(stored_name, listen_input)
                label = f"{stored_name} (Input {live_num})"
            elif rule.get("vmix_input_number"):
                label = f"Input {rule.get('vmix_input_number')}"
            else:
                label = f"Any vMix input (matched Input {listen_input})"

        payload = {
            "source": source,
            "source_label": "Yamaha" if is_yamaha else "vMix",
            "event_name": event_name,
            "event_label": event_name,
            "listen_input": listen_input,
            "listen_label": label,
            "rule_id": rule.get("id"),
            "rule_name": rule.get("name"),
            "action_count": len(actions),
            "command_summary": self._actions_summary(actions),
            "timestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }
        if extra:
            payload.update(extra)
        await ws_manager.broadcast_listen_event(payload)

    # ── Rule execution ────────────────────────────────────────────────────────

    async def _execute_rule_delayed(self, rule: Dict[str, Any]):
        action_rules = self._rule_action_list(rule)
        if rule.get("is_multi_action") or len(action_rules) > 1:
            asyncio.create_task(self._broadcast_trigger(rule["id"]))
            asyncio.create_task(self._record_fire(rule["id"]))

            async def mark_ready_later(action_payload):
                await asyncio.sleep(2.0)
                await self._broadcast_action_state(
                    {**action_payload, "status": "ready"}
                )

            async def run_action(act_rule, val, d, idx):
                action_payload = {
                    "rule_id": act_rule["id"],
                    "action_index": idx,
                    "action_target": act_rule.get("action_target"),
                    "yamaha_command": act_rule.get("yamaha_command"),
                    "yamaha_channel": act_rule.get("yamaha_channel"),
                    "yamaha_mix": act_rule.get("yamaha_mix"),
                    "vmix_function": act_rule.get("vmix_function"),
                    "vmix_target_input": act_rule.get("vmix_target_input"),
                    "value": val,
                }
                await self._broadcast_action_state(
                    {**action_payload, "status": "applying"}
                )
                if d > 0:
                    await asyncio.sleep(d / 1000.0)
                try:
                    ok = await self._execute_action(act_rule, val)
                except Exception as e:
                    ok = False
                    logger.exception(
                        f"Action {idx + 1} failed for rule {act_rule.get('id')}: {e}"
                    )
                    await self._add_log(
                        "ERROR",
                        f"Action {idx + 1} failed for rule '{act_rule.get('name')}': {e}",
                        {"rule_id": act_rule["id"]},
                    )
                await self._broadcast_action_state(
                    {
                        **action_payload,
                        "status": "applied" if ok is not False else "error",
                    }
                )
                asyncio.create_task(mark_ready_later(action_payload))
                return ok

            for action_rule in action_rules:
                await run_action(
                    action_rule,
                    str(action_rule.get("parameter_value", "0")),
                    action_rule.get("delay_ms", 0),
                    (
                        action_rule.get("_action_index")
                        if action_rule.get("_action_index") is not None
                        else 0
                    ),
                )
                await asyncio.sleep(0.05)
        else:
            if rule.get("delay_ms", 0) > 0:
                await asyncio.sleep(rule["delay_ms"] / 1000.0)
            asyncio.create_task(self._broadcast_trigger(rule["id"]))
            asyncio.create_task(self._record_fire(rule["id"]))
            await self._execute_action(rule, rule.get("parameter_value", "0"))

    async def _record_fire(self, rule_id: int):
        try:
            async with AsyncSessionLocal() as db:
                await crud.record_rule_fire(db, rule_id)
        except Exception as e:
            logger.warning(f"Failed to record fire for rule {rule_id}: {e}")

    async def _execute_action(
        self,
        rule: Dict[str, Any],
        target_value: str,
        skip_collision_check: bool = False,
    ):
        """
        Execute a single action (Yamaha RCP command or vMix HTTP call).

        FIX #1 — The Yamaha branch previously fell off the end of the function
        returning None instead of True, causing the multi-action runner to mark
        every Yamaha command as 'error'.  All Yamaha paths now return True on
        success and False on explicit failure.

        FIX #3 — For vMix actions, if the rule has a vmix_input_name the target
        input number is re-resolved from the live map so the correct input is
        addressed even if its number changed since the rule was saved.
        """
        import httpx

        from app.core.config import settings
        from app.drivers import yamaha_tcp

        target_key = (
            f"{rule['action_target']}_{rule.get('yamaha_command')}_"
            f"{rule.get('yamaha_channel')}_{rule.get('yamaha_mix')}_"
            f"{rule.get('vmix_function')}_{rule.get('vmix_target_input')}"
        )
        now = time.time()
        sort_order = rule.get("sort_order", 0)

        if not skip_collision_check and target_key in self._fader_locks:
            last_time, last_priority = self._fader_locks[target_key]
            if now - last_time < 0.5 and sort_order > last_priority:
                await self._add_log(
                    "WARNING",
                    f"Collision prevented: Rule '{rule['name']}' blocked by higher priority rule.",
                    {"rule_id": rule["id"]},
                )
                return False

        self._fader_locks[target_key] = (now, sort_order)

        # ── Yamaha ────────────────────────────────────────────────────────────
        if rule["action_target"] == "yamaha":
            if not yamaha_tcp.connected:
                await self._add_log(
                    "WARNING",
                    f"Yamaha not connected — skipped cmd for rule '{rule['name']}'",
                    {"rule_id": rule["id"]},
                )
                return False

            cmd = rule["yamaha_command"]

            if cmd and cmd.endswith("/Smooth"):
                base_cmd = cmd.replace("/Smooth", "/Level")
                try:
                    parts = target_value.split(",")
                    if len(parts) == 1:
                        await yamaha_tcp.send_command(
                            base_cmd,
                            rule["yamaha_channel"],
                            parts[0],
                            rule["yamaha_mix"],
                        )
                        await self._add_log(
                            "SUCCESS",
                            f"Sent to Yamaha: {base_cmd} ch={rule['yamaha_channel']} val={parts[0]} (instant fallback)",
                            {"rule_id": rule["id"]},
                        )
                        return True
                    elif len(parts) == 2:
                        end_val = int(parts[0])
                        duration = int(parts[1])
                        current_val = await yamaha_tcp.request_value(
                            base_cmd,
                            rule["yamaha_channel"],
                            rule["yamaha_mix"],
                            timeout=1.0,
                        )
                        if current_val is None:
                            current_val = 0
                            await self._add_log(
                                "WARNING",
                                "Could not read current level, defaulting to 0",
                                {"rule_id": rule["id"]},
                            )
                        asyncio.create_task(
                            yamaha_tcp.fade_command(
                                base_cmd,
                                rule["yamaha_channel"],
                                rule["yamaha_mix"],
                                current_val,
                                end_val,
                                duration,
                            )
                        )
                        await self._add_log(
                            "SUCCESS",
                            f"Smooth Fade: {base_cmd} {current_val}→{end_val} over {duration}ms",
                            {"rule_id": rule["id"]},
                        )
                        return True
                    elif len(parts) == 3:
                        asyncio.create_task(
                            yamaha_tcp.fade_command(
                                base_cmd,
                                rule["yamaha_channel"],
                                rule["yamaha_mix"],
                                int(parts[0]),
                                int(parts[1]),
                                int(parts[2]),
                            )
                        )
                        await self._add_log(
                            "SUCCESS",
                            f"Smooth Fade: {base_cmd} {parts[0]}→{parts[1]} over {parts[2]}ms",
                            {"rule_id": rule["id"]},
                        )
                        return True
                except ValueError:
                    pass

            await yamaha_tcp.send_command(
                cmd, rule["yamaha_channel"], target_value, rule["yamaha_mix"]
            )
            await self._add_log(
                "SUCCESS",
                f"Sent to Yamaha: {cmd} ch={rule['yamaha_channel']} val={target_value}",
                {"rule_id": rule["id"]},
            )
            return True  # FIX #1 — was missing, caused "error" status in UI

        # ── vMix ──────────────────────────────────────────────────────────────
        elif rule["action_target"] == "vmix":
            try:
                func = rule.get("vmix_function") or "SetVolume"
                url = f"http://{settings.vmix_host}:{settings.vmix_http_port}/api/"

                # FIX #3 — re-resolve the target input number from the live map
                # so that vMix actions on a named input survive input reordering.
                target_input = rule.get("vmix_target_input")
                target_name = (rule.get("vmix_target_input_name") or "").strip()
                if target_name:
                    resolved_target = self._vmix_input_name_map.get(target_name)
                    if resolved_target is not None:
                        target_input = resolved_target

                params = self._build_vmix_params(func, target_value, target_input)

                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, params=params, timeout=2.0)
                    if resp.status_code == 200:
                        await self._add_log(
                            "SUCCESS",
                            f"Sent to vMix: {func} params={params}",
                            {"rule_id": rule["id"]},
                        )
                        return True
                    await self._add_log(
                        "ERROR",
                        f"vMix API returned {resp.status_code} for {func} params={params}",
                        {"rule_id": rule["id"]},
                    )
                    return False
            except Exception as e:
                await self._add_log(
                    "ERROR",
                    f"Failed to send to vMix: {e}",
                    {"rule_id": rule["id"]},
                )
                return False

        return True

    # ── Cache management ──────────────────────────────────────────────────────

    def invalidate_cache(self):
        from app.engine.group_duck_engine import group_duck_engine

        for state in self._ducking_state.values():
            self._cancel_meter_cycle(state)
        asyncio.create_task(self.reload_rules())
        self._ducking_state.clear()
        group_duck_engine.clear()
        logger.info("[ENGINE] Rules cache invalidated")
        asyncio.create_task(self._sync_monitored_channels())

    def _collect_yamaha_meter_channels(self, rules: List[TriggerRule]) -> set[int]:
        channels = set()
        for rule in rules:
            if rule.is_multi_duck:
                try:
                    members = json.loads(rule.duck_members or "[]")
                except (TypeError, json.JSONDecodeError):
                    members = []
                for member in members:
                    try:
                        channel = int(member.get("monitor_channel") or 0)
                    except (TypeError, ValueError):
                        channel = 0
                    if channel > 0:
                        channels.add(channel)
            elif rule.vmix_input_number:
                channels.add(rule.vmix_input_number)
        return channels

    async def _sync_monitored_channels(self):
        try:
            from app.drivers import yamaha_tcp
            from app.engine.group_duck_engine import group_duck_engine

            channels: set[int] = set()
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(TriggerRule).where(
                        TriggerRule.listen_source == "yamaha",
                        TriggerRule.trigger_event == "YamahaMeter",
                    )
                )
                channels = self._collect_yamaha_meter_channels(
                    list(result.scalars().all())
                )
            await group_duck_engine.reload_cache()
            channels.update(group_duck_engine.get_monitored_channels())
            yamaha_tcp.set_monitored_channels(channels)
            logger.info(f"[ENGINE] Synced monitored channels: {sorted(channels)}")
        except Exception as e:
            logger.error(f"[ENGINE] Failed to sync monitored channels: {e}")


engine = TriggerEngine()
