import asyncio
import logging
from collections import deque
from datetime import datetime
from typing import Dict, Any, List, Callable, Awaitable, Optional
import time

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

    async def handle_yamaha_meter(self, ch_index: int, level: int):
        """Called constantly by Yamaha NOTIFY MIXER:Current/InCh/Meter/Level"""
        cache_key = f"yamaha_YamahaMeter_{ch_index}"
        
        if cache_key in self.rules_cache and (time.time() - self.rules_cache[cache_key]['timestamp'] < self.cache_ttl):
            rules = self.rules_cache[cache_key]['rules']
        else:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(TriggerRule).where(
                    TriggerRule.is_active == True,
                    TriggerRule.listen_source == 'yamaha',
                    TriggerRule.trigger_event == 'YamahaMeter',
                    TriggerRule.vmix_input_number == ch_index
                ))
                rules_raw = result.scalars().all()
                rules = [self._rule_to_dict(r) for r in rules_raw]
                self.rules_cache[cache_key] = {'timestamp': time.time(), 'rules': rules}

        now = time.time()
        for rule in rules:
            rid = rule['id']
            if rid not in self._ducking_state:
                self._ducking_state[rid] = {"status": "idle", "last_speech_time": 0.0, "saved_value": None}
            
            state = self._ducking_state[rid]
            threshold = rule.get('threshold') or -4000
            release_threshold = rule.get('release_threshold')
            if release_threshold is None:
                release_threshold = threshold - 1000  # Default hysteresis: 10dB below attack
            silence_timeout = rule.get('silence_timeout_ms') or 3000
            
            # Broadcast meter update for UI
            asyncio.create_task(self._broadcast_meter(ch_index, level))
            
            if level >= threshold:
                # ATTACK
                state['last_speech_time'] = now
                if state['status'] == "idle":
                    state['status'] = "active"
                    asyncio.create_task(self._duck_and_save(rule, state))
            elif level >= release_threshold:
                # HYSTERESIS ZONE (below attack, but above release)
                # Still counts as speaking to prevent rapid fluttering
                state['last_speech_time'] = now
            else:
                # RELEASE
                if state['status'] == "active":
                    if (now - state['last_speech_time']) * 1000.0 >= silence_timeout:
                        state['status'] = "idle"
                        asyncio.create_task(self._restore_value(rule, state))

    async def _broadcast_meter(self, ch_index: int, level: int):
        from app.api.websocket import ws_manager
        await ws_manager.broadcast_meter(ch_index, level)

    async def _duck_and_save(self, rule: Dict[str, Any], state: Dict[str, Any]):
        from app.drivers import yamaha_tcp
        import httpx
        from lxml import etree

        await self._add_log("INFO", f"Microphone passed threshold on Ch {rule['vmix_input_number']}, initiating ducking.", {"rule_id": rule['id']})

        # 1. Fetch current value before ducking
        try:
            if rule['action_target'] == 'yamaha':
                orig_val = await yamaha_tcp.request_value(rule['yamaha_command'], rule['yamaha_channel'], rule['yamaha_mix'])
                if orig_val is not None:
                    state['saved_value'] = orig_val
            elif rule['action_target'] == 'vmix':
                async with httpx.AsyncClient() as client:
                    resp = await client.get("http://127.0.0.1:8088/api/", timeout=2.0)
                    if resp.status_code == 200:
                        root = etree.fromstring(resp.content)
                        if rule['vmix_function'] == 'SetVolume' and rule['vmix_target_input']:
                            elem = root.find(f".//input[@number='{rule['vmix_target_input']}']")
                            if elem is not None: state['saved_value'] = elem.get('volume')
                        elif rule['vmix_function'] == 'SetMasterVolume':
                            elem = root.find(".//audio/master")
                            if elem is not None: state['saved_value'] = elem.get('volume')
                        elif rule['vmix_function'] and rule['vmix_function'].startswith('SetBus'):
                            bus_letter = rule['vmix_function'].replace('SetBus', '').replace('Volume', '')
                            elem = root.find(f".//audio/bus{bus_letter}")
                            if elem is not None: state['saved_value'] = elem.get('volume')
        except Exception as e:
            logger.warning(f"Failed to save dynamic value before ducking: {e}")

        # 2. Execute Ducking
        await self._execute_action(rule, rule['parameter_value'])

    async def _restore_value(self, rule: Dict[str, Any], state: Dict[str, Any]):
        await self._add_log("INFO", f"Silence timeout reached on Ch {rule['vmix_input_number']}, restoring volume.", {"rule_id": rule['id']})
        if state['saved_value'] is not None:
            await self._execute_action(rule, str(state['saved_value']))
        else:
            await self._add_log("WARNING", "No saved value to restore to!", {"rule_id": rule['id']})

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
            "action_target": r.action_target, "yamaha_command": r.yamaha_command, "yamaha_channel": r.yamaha_channel, "yamaha_mix": r.yamaha_mix,
            "vmix_function": r.vmix_function, "vmix_target_input": r.vmix_target_input,
            "parameter_value": r.parameter_value, "delay_ms": r.delay_ms
        }

    async def _broadcast_trigger(self, rule_id: int):
        from app.api.websocket import ws_manager
        await ws_manager.broadcast_trigger(rule_id)

    async def _execute_rule_delayed(self, rule: Dict[str, Any]):
        if rule['delay_ms'] > 0:
            await asyncio.sleep(rule['delay_ms'] / 1000.0)
        asyncio.create_task(self._broadcast_trigger(rule['id']))
        asyncio.create_task(self._record_fire(rule['id']))
        await self._execute_action(rule, rule['parameter_value'])

    async def _record_fire(self, rule_id: int):
        try:
            async with AsyncSessionLocal() as db:
                await crud.record_rule_fire(db, rule_id)
        except Exception as e:
            logger.warning(f"Failed to record fire for rule {rule_id}: {e}")

    async def _execute_action(self, rule: Dict[str, Any], target_value: str):
        from app.drivers import yamaha_tcp
        import httpx

        target_key = f"{rule['action_target']}_{rule.get('yamaha_command')}_{rule.get('yamaha_channel')}_{rule.get('yamaha_mix')}_{rule.get('vmix_function')}_{rule.get('vmix_target_input')}"
        now = time.time()
        
        # Check collision: if this target was modified within 0.5s by a HIGHER priority rule (lower sort_order), skip.
        if target_key in self._fader_locks:
            last_time, last_priority = self._fader_locks[target_key]
            if now - last_time < 0.5 and rule['sort_order'] > last_priority:
                await self._add_log("WARNING", f"Collision prevented: Rule '{rule['name']}' blocked by higher priority rule.", {"rule_id": rule['id']})
                return
                
        self._fader_locks[target_key] = (now, rule['sort_order'])

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
                    if len(parts) == 2:
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
                func = rule['vmix_function']
                input_param = f"&Input={rule['vmix_target_input']}" if rule['vmix_target_input'] else ""
                url = f"http://127.0.0.1:8088/api/?Function={func}&Value={target_value}{input_param}"
                
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, timeout=2.0)
                    if resp.status_code == 200:
                        await self._add_log("SUCCESS", f"Sent to vMix: {func} val={target_value}", {"rule_id": rule['id']})
                    else:
                        await self._add_log("ERROR", f"vMix API returned {resp.status_code}", {"rule_id": rule['id']})
            except Exception as e:
                await self._add_log("ERROR", f"Failed to send to vMix: {e}", {"rule_id": rule['id']})

    def invalidate_cache(self):
        self.rules_cache.clear()

engine = TriggerEngine()
