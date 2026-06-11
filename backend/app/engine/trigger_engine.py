import asyncio
import json
import logging
from collections import deque
from datetime import datetime
from typing import Dict, Any, List, Callable, Awaitable, Optional
import time

from sqlalchemy import or_
from sqlalchemy.future import select

from app.db.database import AsyncSessionLocal
from app.db.models import TriggerRule, ActivityLog
import app.db.crud as crud

logger = logging.getLogger(__name__)

class TriggerEngine:
    def __init__(self, log_capacity: int = 100):
        self.log_capacity = log_capacity
        self.execution_log: deque = deque(maxlen=log_capacity)
        self.callbacks: List[Callable[[Dict[str, Any]], Awaitable[None]]] = []
        
        self.vmix_connected = False
        self.yamaha_connected = False
        
        self.rules_cache: Dict[str, Any] = {}
        self.cache_ttl = 2.0
        
        self._last_audio_state: Dict[int, bool] = {}
        self._poller_task: Optional[asyncio.Task] = None
        
        self._last_rule_execution: Dict[int, float] = {}
        
        # Track if TimeRemaining has fired for a video to prevent spamming
        self._time_triggered_state: Dict[str, bool] = {}
        
        # Ducking State for Yamaha Meters
        self._ducking_state: Dict[int, Dict[str, Any]] = {}
        
        # Collision Detection: { target_key: (timestamp, priority_sort_order) }
        self._fader_locks: Dict[str, tuple[float, int]] = {}
        
        self._meter_log_count = 0  # Limit verbose meter logging

    def start_xml_poller(self, host: str, port: int):
        if not self._poller_task:
            print(f"   [*] Starting XML Audio Poller -> http://{host}:{port}/api/")
            self._poller_task = asyncio.create_task(self._xml_poll_loop(host, port))

    async def _xml_poll_loop(self, host: str, port: int):
        import httpx
        from lxml import etree
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
                            logger.info("XML Audio Poller: Successfully connected to vMix HTTP API")
                            await self._add_log("INFO", f"Audio Poller connected to vMix at {url}")
                            _logged_first_success = True
                            _logged_first_error = False
                        
                        root = etree.fromstring(resp.content)
                        for input_elem in root.xpath("//inputs/input"):
                            input_number = int(input_elem.get("number"))
                            is_muted = input_elem.get("muted") == "True"
                            
                            last_muted = self._last_audio_state.get(input_number)
                            if last_muted is not None and last_muted != is_muted:
                                event_name = "AudioOff" if is_muted else "AudioOn"
                                logger.info(f"XML Poller detected: {event_name} on Input {input_number}")
                                await self._add_log("INFO", f"Audio {event_name} detected on Input {input_number}")
                                await self._process_match("vmix", event_name, input_number)
                            
                            self._last_audio_state[input_number] = is_muted
                            
                            # Time Remaining Logic
                            state = input_elem.get("state")
                            duration = int(input_elem.get("duration", "0"))
                            position = int(input_elem.get("position", "0"))
                            
                            if state == "Running" and duration > 0 and position > 0:
                                time_remaining_ms = duration - position
                                await self._evaluate_time_remaining(input_number, time_remaining_ms)
                            elif position < 1000 or state != "Running":
                                # Reset trigger state if video restarts or stops
                                self._reset_time_trigger(input_number)
                                
            except Exception as e:
                if not _logged_first_error:
                    logger.warning(f"XML Audio Poller error: {e}")
                    await self._add_log("WARNING", f"Audio Poller cannot reach vMix HTTP API at {url}: {e}")
                    _logged_first_error = True
                    _logged_first_success = False
            
            await asyncio.sleep(0.3)

    def _reset_time_trigger(self, input_number: int):
        keys_to_remove = [k for k in self._time_triggered_state.keys() if k.endswith(f"_{input_number}")]
        for k in keys_to_remove:
            del self._time_triggered_state[k]

    async def _evaluate_time_remaining(self, input_number: int, time_remaining_ms: int):
        cache_key = f"vmix_TimeRemaining_all"
        
        if cache_key in self.rules_cache and (time.time() - self.rules_cache[cache_key]['timestamp'] < self.cache_ttl):
            rules = self.rules_cache[cache_key]['rules']
        else:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(TriggerRule).where(
                    TriggerRule.is_active == True,
                    TriggerRule.listen_source == 'vmix',
                    TriggerRule.trigger_event == 'TimeRemaining'
                ))
                rules_raw = result.scalars().all()
                rules = [self._rule_to_dict(r) for r in rules_raw]
                self.rules_cache[cache_key] = {'timestamp': time.time(), 'rules': rules}
                
        for rule in rules:
            if rule['vmix_input_number'] and rule['vmix_input_number'] != input_number:
                continue
                
            trigger_key = f"{rule['id']}_{input_number}"
            if self._time_triggered_state.get(trigger_key):
                continue
                
            time_str = rule.get('time_threshold')
            if not time_str:
                continue
                
            # Parse HH:MM:SS to ms
            try:
                parts = time_str.split(':')
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
                await self._add_log("INFO", msg, {"rule_id": rule['id']})
                asyncio.create_task(self._execute_rule_delayed(rule))

    def add_log_callback(self, cb: Callable[[Dict[str, Any]], Awaitable[None]]):
        self.callbacks.append(cb)

    async def _add_log(self, level: str, message: str, meta: Optional[Dict[str, Any]] = None):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": level,
            "message": message,
            "meta": meta or {}
        }
        self.execution_log.append(log_entry)
        logger.info(f"[{level}] {message}")
        for cb in self.callbacks:
            try: await cb(log_entry)
            except Exception as e: logger.error(f"Error in engine callback: {e}")
            
        # Asynchronously save to database
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
                level=level
            )
            async with AsyncSessionLocal() as db:
                await crud.create_activity_log(db, log_data)
        except Exception as e:
            logger.error(f"Failed to save activity log to db: {e}")

    async def handle_vmix_status(self, is_connected: bool):
        self.vmix_connected = is_connected
        await self._add_log("INFO", f"vMix TCP Connection {'Established' if is_connected else 'Lost'}")

    async def handle_yamaha_status(self, is_connected: bool):
        self.yamaha_connected = is_connected
        await self._add_log("INFO", f"Yamaha TF3 Connection {'Established' if is_connected else 'Lost'}")

    async def ingest_vmix_event(self, raw_event: str):
        parts = raw_event.split()
        if not parts: return

        if parts[0] == "ACTS" and len(parts) >= 5 and parts[1] == "OK":
            activator = parts[2]
            try:
                input_number = int(parts[3])
                value = parts[4]
                event_names = []
                
                if activator == "Input":
                    event_names.append("TransitionIn" if value == "1" else "TransitionOut")
                elif activator == "Preview":
                    event_names.append("InputPreview")
                elif activator == "InputPlaying":
                    if value == "1": event_names.extend(["TransitionIn", "VideoPlay"])
                    else: event_names.extend(["TransitionOut", "VideoPause"])
                elif activator in ("Audio", "InputAudio", "AudioOn"):
                    event_names.append("AudioOn" if value == "1" else "AudioOff")
                elif activator.startswith("Overlay") and activator[-1].isdigit():
                    event_names.append("OverlayIn" if value == "1" else "OverlayOut")

                for event_name in event_names:
                    await self._process_match("vmix", event_name, input_number)
            except ValueError:
                pass

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
        """RCP path used to read the current value before ducking."""
        if yamaha_command.endswith('/Smooth'):
            return yamaha_command.replace('/Smooth', '/Level')
        return yamaha_command

    def _yamaha_level_command(self, yamaha_command: str) -> str:
        """RCP path used for level fades (Smooth commands map to Level)."""
        return self._yamaha_read_command(yamaha_command)

    def _is_yamaha_level_command(self, yamaha_command: str) -> bool:
        return yamaha_command.endswith('/Level') or yamaha_command.endswith('/Smooth')

    def _smooth_duration_ms(self, rule: Dict[str, Any]) -> int:
        parts = str(rule.get('parameter_value', '')).split(',')
        if len(parts) >= 2:
            try:
                return int(parts[-1])
            except ValueError:
                pass
        return 1000

    async def _cancel_yamaha_fade(self, rule: Dict[str, Any]):
        from app.drivers import yamaha_tcp
        cmd = rule.get('yamaha_command', '')
        if cmd.endswith('/Smooth') or cmd.endswith('/Level'):
            base = self._yamaha_level_command(cmd) if cmd.endswith('/Smooth') else cmd
            yamaha_tcp.cancel_fade(base, rule['yamaha_channel'], rule['yamaha_mix'])
            await asyncio.sleep(0.02)

    async def _capture_action_value_once(self, rule: Dict[str, Any]) -> Optional[Any]:
        """Read the live value that will be restored after speech stops."""
        from app.drivers import yamaha_tcp
        from app.core.config import settings
        import httpx
        from lxml import etree

        try:
            if rule['action_target'] == 'yamaha':
                cmd = self._yamaha_read_command(rule['yamaha_command'])
                await self._cancel_yamaha_fade(rule)
                return await yamaha_tcp.request_value(
                    cmd, rule['yamaha_channel'], rule['yamaha_mix'], timeout=2.0
                )
            if rule['action_target'] == 'vmix':
                url = f"http://{settings.vmix_host}:{settings.vmix_http_port}/api/"
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, timeout=2.0)
                    if resp.status_code != 200:
                        return None
                    root = etree.fromstring(resp.content)
                    func = rule.get('vmix_function') or ''
                    if func == 'SetVolume' and rule.get('vmix_target_input'):
                        elem = root.find(f".//input[@number='{rule['vmix_target_input']}']")
                        return elem.get('volume') if elem is not None else None
                    if func == 'SetMasterVolume':
                        elem = root.find(".//audio/master")
                        return elem.get('volume') if elem is not None else None
                    if func.startswith('SetBus') and func.endswith('Volume'):
                        bus_letter = func.replace('SetBus', '').replace('Volume', '')
                        elem = root.find(f".//audio/bus{bus_letter}")
                        return elem.get('volume') if elem is not None else None
        except Exception as e:
            logger.warning(f"Failed to capture current value for rule {rule.get('id')}: {e}")
        return None

    async def _capture_action_value(self, rule: Dict[str, Any]) -> Optional[Any]:
        """Retry capture so Yamaha GET is reliable even when the socket is busy."""
        for attempt in range(3):
            value = await self._capture_action_value_once(rule)
            if value is not None:
                return value
            await asyncio.sleep(0.08 * (attempt + 1))
        return None

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
            logger.info(f"[ENGINE] handle_yamaha_meter called: ch={ch_index}, level={level}")
            if self._meter_log_count == 10:
                logger.info("[ENGINE] Suppressing further meter debug logs (working correctly)")

        cache_key = f"yamaha_YamahaMeter_{ch_index}"

        if cache_key in self.rules_cache and (time.time() - self.rules_cache[cache_key]['timestamp'] < self.cache_ttl):
            rules = self.rules_cache[cache_key]['rules']
        else:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(TriggerRule).where(
                    TriggerRule.is_active == True,
                    TriggerRule.listen_source == 'yamaha',
                    TriggerRule.trigger_event == 'YamahaMeter',
                    or_(TriggerRule.is_multi_duck == False, TriggerRule.is_multi_duck.is_(None)),
                    TriggerRule.vmix_input_number == ch_index
                ))
                rules_raw = result.scalars().all()
                rules = [self._rule_to_dict(r) for r in rules_raw]
                self.rules_cache[cache_key] = {'timestamp': time.time(), 'rules': rules}

        now = time.time()
        for rule in rules:
            state = self._get_meter_state(rule['id'])
            threshold = rule.get('threshold') or -4000
            release_threshold = rule.get('release_threshold')
            if release_threshold is None:
                release_threshold = threshold - 1000
            silence_timeout = rule.get('silence_timeout_ms') or 3000

            if level >= threshold:
                state['last_speech_time'] = now
                if state['status'] == 'restoring':
                    self._cancel_meter_cycle(state)
                    state['status'] = 'active'
                    asyncio.create_task(self._resume_duck_after_interrupt(rule, state))
                elif state['status'] == 'idle':
                    state['status'] = 'attacking'
                    self._start_meter_cycle(rule, state, self._duck_and_save(rule, state))
            elif level >= release_threshold:
                state['last_speech_time'] = now
            elif state['status'] == 'active':
                if (now - state['last_speech_time']) * 1000.0 >= silence_timeout:
                    if state.get('saved_value') is not None:
                        state['status'] = 'restoring'
                        self._start_meter_cycle(rule, state, self._restore_value(rule, state))
                    else:
                        state['status'] = 'idle'

    def _start_meter_cycle(self, rule: Dict[str, Any], state: Dict[str, Any], coro):
        self._cancel_meter_cycle(state)
        state['cycle_task'] = asyncio.create_task(coro)

    def _cancel_meter_cycle(self, state: Dict[str, Any]):
        task = state.get('cycle_task')
        if task and not task.done():
            task.cancel()
        state['cycle_task'] = None

    async def _broadcast_meter(self, ch_index: int, level: int):
        from app.api.websocket import ws_manager
        await ws_manager.broadcast_meter(ch_index, level)

    async def _resume_duck_after_interrupt(self, rule: Dict[str, Any], state: Dict[str, Any]):
        """Speech resumed during restore — cancel restore fade and re-apply duck command."""
        from app.drivers import yamaha_tcp

        async with state['lock']:
            if rule['action_target'] == 'yamaha' and rule['yamaha_command'].endswith('/Smooth'):
                base_cmd = self._yamaha_level_command(rule['yamaha_command'])
                yamaha_tcp.cancel_fade(base_cmd, rule['yamaha_channel'], rule['yamaha_mix'])
            await self._apply_meter_action(rule, rule['parameter_value'], is_restore=False)
            await self._add_log(
                "INFO",
                f"Speech resumed on Ch {rule['vmix_input_number']} — ducking re-applied.",
                {"rule_id": rule['id']},
            )

    async def _duck_and_save(self, rule: Dict[str, Any], state: Dict[str, Any]):
        try:
            async with state['lock']:
                saved = await self._capture_action_value(rule)
                if saved is None:
                    state['saved_value'] = None
                    await self._add_log(
                        "WARNING",
                        f"Could not read current state for '{rule['name']}'; applying without restore snapshot.",
                        {"rule_id": rule['id']},
                    )

                state['saved_value'] = saved
                await self._apply_meter_action(
                    rule, rule['parameter_value'], is_restore=False, saved_start=saved
                )
                asyncio.create_task(self._broadcast_trigger(rule['id']))
                asyncio.create_task(self._record_fire(rule['id']))
                state['status'] = 'active'
                await self._add_log(
                    "INFO",
                    f"Mic active on Ch {rule['vmix_input_number']} — applied command (saved={saved}).",
                    {"rule_id": rule['id']},
                )
        except asyncio.CancelledError:
            if state['status'] == 'attacking':
                state['status'] = 'idle'
            raise
        except Exception as e:
            logger.error(f"Duck cycle failed for rule {rule['id']}: {e}")
            state['status'] = 'idle'
            state['saved_value'] = None

    async def _restore_value(self, rule: Dict[str, Any], state: Dict[str, Any]):
        try:
            async with state['lock']:
                saved = state.get('saved_value')
                if saved is None:
                    state['status'] = 'idle'
                    await self._add_log(
                        "WARNING",
                        f"No saved state to restore for rule '{rule['name']}'.",
                        {"rule_id": rule['id']},
                    )
                    return

                await self._apply_meter_action(rule, saved, is_restore=True)
                state['saved_value'] = None
                state['status'] = 'idle'
                await self._add_log(
                    "INFO",
                    f"Silence on Ch {rule['vmix_input_number']} — restored to previous state ({saved}).",
                    {"rule_id": rule['id']},
                )
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Restore cycle failed for rule {rule['id']}: {e}")
            state['status'] = 'active'

    async def _apply_meter_action(
        self,
        rule: Dict[str, Any],
        value: Any,
        is_restore: bool = False,
        saved_start: Optional[Any] = None,
    ):
        """Apply duck or restore for meter rules — all Yamaha + vMix volume/mute types."""
        from app.drivers import yamaha_tcp

        if rule['action_target'] == 'yamaha':
            if not yamaha_tcp.connected:
                await self._add_log(
                    "WARNING",
                    f"Yamaha not connected — skipped meter action for '{rule['name']}'",
                    {"rule_id": rule['id']},
                )
                return

            cmd = rule['yamaha_command']
            ch, mix = rule['yamaha_channel'], rule['yamaha_mix']

            if cmd.endswith('/Smooth'):
                base_cmd = self._yamaha_level_command(cmd)
                await self._cancel_yamaha_fade(rule)
                duration = self._smooth_duration_ms(rule)

                if is_restore:
                    end_val = int(value)
                    current_val = await yamaha_tcp.request_value(base_cmd, ch, mix, timeout=2.0)
                    if current_val is None:
                        current_val = end_val
                    await yamaha_tcp.fade_command(base_cmd, ch, mix, current_val, end_val, duration)
                    await yamaha_tcp.await_fade(base_cmd, ch, mix)
                    await self._add_log(
                        "SUCCESS",
                        f"Restored smooth: {base_cmd} → {end_val} over {duration}ms",
                        {"rule_id": rule['id']},
                    )
                    return

                parts = str(value).split(',')
                if len(parts) == 3:
                    start_val, end_val, dur = int(parts[0]), int(parts[1]), int(parts[2])
                elif len(parts) == 2:
                    end_val, dur = int(parts[0]), int(parts[1])
                    start_val = int(saved_start) if saved_start is not None else await yamaha_tcp.request_value(
                        base_cmd, ch, mix, timeout=2.0
                    )
                    if start_val is None:
                        start_val = 0
                else:
                    await yamaha_tcp.send_command(base_cmd, ch, str(value), mix)
                    await self._add_log("SUCCESS", f"Meter duck: {cmd} val={value}", {"rule_id": rule['id']})
                    return

                await yamaha_tcp.fade_command(base_cmd, ch, mix, start_val, end_val, dur)
                await self._add_log(
                    "SUCCESS",
                    f"Meter duck fade: {base_cmd} {start_val} → {end_val} over {dur}ms",
                    {"rule_id": rule['id']},
                )
                return

            target = str(int(value)) if isinstance(value, (int, float)) else str(value)
            await yamaha_tcp.send_command(cmd, ch, target, mix)
            action = "Restored" if is_restore else "Applied"
            await self._add_log(
                "SUCCESS",
                f"{action} Yamaha: {cmd} ch={ch} mix={mix} val={target}",
                {"rule_id": rule['id']},
            )
            return

        await self._execute_action(rule, str(value), skip_collision_check=True)

    async def _process_match(self, source: str, event_name: str, input_number: int):
        cache_key = f"{source}_{event_name}_{input_number}"

        if cache_key in self.rules_cache and (time.time() - self.rules_cache[cache_key]['timestamp'] < self.cache_ttl):
            rules = self.rules_cache[cache_key]['rules']
        else:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(TriggerRule).where(
                    TriggerRule.is_active == True,
                    TriggerRule.listen_source == source,
                    TriggerRule.trigger_event == event_name,
                    TriggerRule.vmix_input_number == input_number
                ))
                rules_raw = result.scalars().all()
                rules = [self._rule_to_dict(r) for r in rules_raw]
                self.rules_cache[cache_key] = {'timestamp': time.time(), 'rules': rules}

        now = time.time()
        for rule in rules:
            last_exec = self._last_rule_execution.get(rule['id'], 0.0)
            if now - last_exec < 0.5:
                continue
                
            self._last_rule_execution[rule['id']] = now
            msg = f"Matched rule '{rule['name']}' — {rule['trigger_event']} on Input {rule['vmix_input_number']}"
            logger.info(msg)
            asyncio.create_task(self._add_log("INFO", msg, {"rule_id": rule['id']}))
            
            asyncio.create_task(self._execute_rule_delayed(rule))

    def _rule_to_dict(self, r) -> Dict[str, Any]:
        return {
            "id": r.id, "name": r.name, "sort_order": r.sort_order,
            "listen_source": r.listen_source, "trigger_event": r.trigger_event, "vmix_input_number": r.vmix_input_number,
            "threshold": r.threshold, "release_threshold": r.release_threshold, "silence_timeout_ms": r.silence_timeout_ms,
            "time_threshold": r.time_threshold,
            "is_multi_duck": r.is_multi_duck, "duck_members": r.duck_members,
            "is_multi_action": r.is_multi_action, "actions": r.actions,
            "action_target": r.action_target, "yamaha_command": r.yamaha_command, "yamaha_channel": r.yamaha_channel, "yamaha_mix": r.yamaha_mix,
            "vmix_function": r.vmix_function, "vmix_target_input": r.vmix_target_input,
            "parameter_value": r.parameter_value, "delay_ms": r.delay_ms
        }

    async def _broadcast_trigger(self, rule_id: int):
        from app.api.websocket import ws_manager
        await ws_manager.broadcast_trigger(rule_id)

    async def _broadcast_action_state(self, payload: Dict[str, Any]):
        from app.api.websocket import ws_manager
        await ws_manager.broadcast_action_state(payload)

    async def _execute_rule_delayed(self, rule: Dict[str, Any]):
        if rule.get('is_multi_action'):
            asyncio.create_task(self._broadcast_trigger(rule['id']))
            asyncio.create_task(self._record_fire(rule['id']))
            
            try:
                actions = json.loads(rule.get('actions') or "[]")
            except (TypeError, json.JSONDecodeError):
                actions = []
            
            for index, action in enumerate(actions):
                # Construct a pseudo-rule to pass to _execute_action
                action_rule = {
                    **rule,
                    "action_target": action.get("action_target", "yamaha"),
                    "yamaha_command": action.get("yamaha_command", "InCh/Fader/Level"),
                    "yamaha_channel": action.get("yamaha_channel", 1),
                    "yamaha_mix": action.get("yamaha_mix", 0),
                    "vmix_function": action.get("vmix_function"),
                    "vmix_target_input": action.get("vmix_target_input"),
                }
                target_value = str(action.get("parameter_value", "0"))
                delay = action.get("delay_ms", 0)
                
                async def run_action(act_rule, val, d, idx):
                    if d > 0:
                        await asyncio.sleep(d / 1000.0)
                    await self._execute_action(act_rule, val)
                    await self._broadcast_action_state({
                        "rule_id": act_rule['id'],
                        "action_index": idx,
                        "status": "applied"
                    })
                    await asyncio.sleep(2.0)
                    await self._broadcast_action_state({
                        "rule_id": act_rule['id'],
                        "action_index": idx,
                        "status": "ready"
                    })
                
                asyncio.create_task(run_action(action_rule, target_value, delay, index))
        else:
            if rule.get('delay_ms', 0) > 0:
                await asyncio.sleep(rule['delay_ms'] / 1000.0)
            asyncio.create_task(self._broadcast_trigger(rule['id']))
            asyncio.create_task(self._record_fire(rule['id']))
            await self._execute_action(rule, rule.get('parameter_value', '0'))

    async def _record_fire(self, rule_id: int):
        try:
            async with AsyncSessionLocal() as db:
                await crud.record_rule_fire(db, rule_id)
        except Exception as e:
            logger.warning(f"Failed to record fire for rule {rule_id}: {e}")

    async def _execute_action(self, rule: Dict[str, Any], target_value: str, skip_collision_check: bool = False):
        from app.drivers import yamaha_tcp
        from app.core.config import settings
        import httpx

        target_key = f"{rule['action_target']}_{rule.get('yamaha_command')}_{rule.get('yamaha_channel')}_{rule.get('yamaha_mix')}_{rule.get('vmix_function')}_{rule.get('vmix_target_input')}"
        now = time.time()
        sort_order = rule.get('sort_order', 0)
        
        # Check collision: if this target was modified within 0.5s by a HIGHER priority rule (lower sort_order), skip.
        if not skip_collision_check and target_key in self._fader_locks:
            last_time, last_priority = self._fader_locks[target_key]
            if now - last_time < 0.5 and sort_order > last_priority:
                await self._add_log("WARNING", f"Collision prevented: Rule '{rule['name']}' blocked by higher priority rule.", {"rule_id": rule['id']})
                return
                
        self._fader_locks[target_key] = (now, sort_order)

        if rule['action_target'] == 'yamaha':
            if not yamaha_tcp.connected:
                await self._add_log("WARNING", f"Yamaha not connected — skipped cmd for rule '{rule['name']}'", {"rule_id": rule['id']})
                return

            cmd = rule['yamaha_command']
            
            if cmd == 'USB/Record/Start':
                await yamaha_tcp.send_command('Recorder/Source', 1, str(rule['yamaha_mix']), 0)
                await asyncio.sleep(0.1)
                await yamaha_tcp.send_command('Recorder/Transport', 1, "Rec", 0)
                await self._add_log("SUCCESS", f"Sent USB Record Start (Source: Aux {rule['yamaha_mix']})", {"rule_id": rule['id']})
                return

            if cmd == 'USB/Play/Start':
                await yamaha_tcp.send_command('Player/Transport', 1, "Play", 0)
                await self._add_log("SUCCESS", "Sent USB Play Start", {"rule_id": rule['id']})
                return
                
            if cmd == 'USB/Play/Stop':
                await yamaha_tcp.send_command('Player/Transport', 1, "Stop", 0)
                await self._add_log("SUCCESS", "Sent USB Play Stop", {"rule_id": rule['id']})
                return

            if cmd and cmd.endswith('/Smooth'):
                base_cmd = cmd.replace('/Smooth', '/Level')
                try:
                    parts = target_value.split(',')
                    if len(parts) == 1:
                        await yamaha_tcp.send_command(base_cmd, rule['yamaha_channel'], parts[0], rule['yamaha_mix'])
                        await self._add_log("SUCCESS", f"Sent to Yamaha: {base_cmd} ch={rule['yamaha_channel']} val={parts[0]} (Fallback to instant)", {"rule_id": rule['id']})
                        return
                    elif len(parts) == 2:
                        # Auto-detect start level from mixer
                        end_val = int(parts[0])
                        duration = int(parts[1])
                        current_val = await yamaha_tcp.request_value(base_cmd, rule['yamaha_channel'], rule['yamaha_mix'], timeout=1.0)
                        if current_val is None:
                            current_val = 0  # Fallback to 0dB if query fails
                            await self._add_log("WARNING", f"Could not read current level, defaulting to 0", {"rule_id": rule['id']})
                        asyncio.create_task(yamaha_tcp.fade_command(base_cmd, rule['yamaha_channel'], rule['yamaha_mix'], current_val, end_val, duration))
                        await self._add_log("SUCCESS", f"Started Smooth Fade: {base_cmd} from {current_val} to {end_val} over {duration}ms (auto-detected start)", {"rule_id": rule['id']})
                        return
                    elif len(parts) == 3:
                        asyncio.create_task(yamaha_tcp.fade_command(base_cmd, rule['yamaha_channel'], rule['yamaha_mix'], int(parts[0]), int(parts[1]), int(parts[2])))
                        await self._add_log("SUCCESS", f"Started Smooth Fade: {base_cmd} from {parts[0]} to {parts[1]} over {parts[2]}ms", {"rule_id": rule['id']})
                        return
                except ValueError: pass

            await yamaha_tcp.send_command(cmd, rule['yamaha_channel'], target_value, rule['yamaha_mix'])
            await self._add_log("SUCCESS", f"Sent to Yamaha: {cmd} ch={rule['yamaha_channel']} val={target_value}", {"rule_id": rule['id']})

        elif rule['action_target'] == 'vmix':
            try:
                func = rule.get('vmix_function') or 'SetVolume'
                url = f"http://{settings.vmix_host}:{settings.vmix_http_port}/api/"
                params = {"Function": func, "Value": target_value}
                if rule.get('vmix_target_input'):
                    params["Input"] = rule['vmix_target_input']
                
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, params=params, timeout=2.0)
                    if resp.status_code == 200:
                        await self._add_log("SUCCESS", f"Sent to vMix: {func} val={target_value}", {"rule_id": rule['id']})
                    else:
                        await self._add_log("ERROR", f"vMix API returned {resp.status_code}", {"rule_id": rule['id']})
            except Exception as e:
                await self._add_log("ERROR", f"Failed to send to vMix: {e}", {"rule_id": rule['id']})

    def invalidate_cache(self):
        from app.engine.group_duck_engine import group_duck_engine
        for state in self._ducking_state.values():
            self._cancel_meter_cycle(state)
        self.rules_cache.clear()
        self._ducking_state.clear()
        group_duck_engine.clear()
        logger.info("[ENGINE] Rules cache invalidated")
        # Sync monitored channels with the Yamaha driver
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
        """Query Yamaha meter rules and sync driver channels.

        Meter subscriptions include inactive rules so the UI meters can preview
        signal. Action execution still queries active rules only.
        """
        try:
            from app.drivers import yamaha_tcp
            from app.engine.group_duck_engine import group_duck_engine
            channels = set()
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(TriggerRule).where(
                    TriggerRule.listen_source == 'yamaha',
                    TriggerRule.trigger_event == 'YamahaMeter',
                ))
                channels = self._collect_yamaha_meter_channels(list(result.scalars().all()))
            await group_duck_engine.reload_cache()
            channels.update(group_duck_engine.get_monitored_channels())
            yamaha_tcp.set_monitored_channels(channels)
            logger.info(f"[ENGINE] Synced monitored channels: {sorted(channels)}")
        except Exception as e:
            logger.error(f"[ENGINE] Failed to sync monitored channels: {e}")

engine = TriggerEngine()
