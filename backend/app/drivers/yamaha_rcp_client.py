import asyncio
import logging
from typing import Callable, Optional, Awaitable, Dict

from app.drivers.yamaha_meter_table import METER_TABLE

logger = logging.getLogger(__name__)

# TF series: mtrstart transmission expires after ~10s (Yamaha RCP spec §4.4)
METER_STREAM_PATH = "MIXER:Current/InCh/PostOn"
METER_INTERVAL_MS = 100
METER_KEEPALIVE_SEC = 8

class YamahaRCPClient:
    """
    Asynchronous TCP client for Yamaha TF3 (Port 49280).
    Formulates and streams raw Yamaha RCP commands using a thread-safe
    asyncio Queue.
    """
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None
        self.connected = False
        self.reconnecting = False
        self._command_queue = asyncio.Queue()
        self._on_status_callback: Optional[Callable[[bool], Awaitable[None]]] = None
        self._meter_callback: Optional[Callable[[int, int], Awaitable[None]]] = None
        
        self._active_fades: Dict[str, asyncio.Task] = {}
        self._pending_requests: Dict[str, asyncio.Future] = {}
        self._request_lock = asyncio.Lock()
        
        self._read_task: Optional[asyncio.Task] = None
        self._write_task: Optional[asyncio.Task] = None
        self._meter_keepalive_task: Optional[asyncio.Task] = None
        self._monitored_channels: set = set()  # channels to actively poll
        
        self._base_delay = 1.0
        self._max_delay = 30.0
        self._meter_received_count = 0

    def set_status_callback(self, on_status_change: Callable[[bool], Awaitable[None]]):
        self._on_status_callback = on_status_change

    def set_meter_callback(self, cb: Callable[[int, int], Awaitable[None]]):
        """Register a callback that receives (channel_1based, level) from NOTIFY meter lines."""
        self._meter_callback = cb

    async def connect(self):
        """Establish connection with exponential backoff."""
        if self.connected or self.reconnecting:
            return

        self.reconnecting = True
        delay = self._base_delay

        while self.reconnecting:
            try:
                logger.info(f"Connecting to Yamaha TF3 at {self.host}:{self.port}...")
                self.reader, self.writer = await asyncio.open_connection(self.host, self.port)
                self.connected = True
                self.reconnecting = False
                logger.info("Yamaha TF3 Connected.")
                
                if self._on_status_callback:
                    await self._on_status_callback(True)

                # Subscribe to device status changes (general parameter NOTIFYs)
                await self.send_raw("devstatus subscribe")
                logger.info("Sent 'devstatus subscribe' to Yamaha TF3")

                # Start the IO loops
                self._read_task = asyncio.create_task(self._read_loop())
                self._write_task = asyncio.create_task(self._write_loop())

                # Start meter stream keepalive (re-requests before 10s RCP timeout)
                self._start_meter_keepalive()
                if self._monitored_channels:
                    await self._request_meter_stream()
                
                return

            except (ConnectionRefusedError, TimeoutError, OSError) as e:
                logger.warning(f"Yamaha TF3 connection failed: {e}. Retrying in {delay}s...")
                await asyncio.sleep(delay)
                delay = min(delay * 2, self._max_delay)

    async def disconnect(self):
        """Close the connection cleanly."""
        self.reconnecting = False
        self.connected = False
        
        if self._read_task:
            self._read_task.cancel()
        if self._write_task:
            self._write_task.cancel()
        if self._meter_keepalive_task:
            self._meter_keepalive_task.cancel()
            self._meter_keepalive_task = None
            
        if self.writer:
            try:
                self.writer.close()
                await self.writer.wait_closed()
            except Exception:
                pass
            
        self.writer = None
        self.reader = None
        logger.info("Yamaha TF3 Disconnected.")
        
        if self._on_status_callback:
            await self._on_status_callback(False)

    def _translate_path(self, rcp_path: str):
        """
        Translate user-facing RCP path names to the actual TF3 protocol paths.
        Based on official Yamaha TF RCP documentation:
          Matrix -> Mtrx, ToFX -> ToFx, FXRTN -> FxRtnCh, St stays St
        """
        actual = rcp_path
        actual = actual.replace("Matrix", "Mtrx")
        actual = actual.replace("ToFX", "ToFx")
        if actual.startswith("FXRTN/"):
            actual = actual.replace("FXRTN/", "FxRtnCh/")
        return actual

    def _needs_single_index(self, actual_path: str) -> bool:
        """Returns True if this path type only uses ch_index (not mix_index)."""
        return (actual_path.startswith("Mtrx/") or 
                actual_path.startswith("FxRtnCh/") or 
                actual_path.startswith("St/") or
                actual_path.startswith("Mono/"))

    def _resolve_indices(self, actual_path: str, channel: int, mix: int) -> tuple[int, int]:
        """Map UI channel/mix fields to Yamaha RCP X/Y indices."""
        if actual_path.startswith("Mix/"):
            bus = mix if mix > 0 else channel
            return max(0, bus - 1), 0
        if actual_path.startswith("St/") or actual_path.startswith("Mono/"):
            return 0, 0

        ch_index = max(0, channel - 1)
        if actual_path.startswith("FxRtnCh/"):
            if channel == 1:
                ch_index = 0
            elif channel == 2:
                ch_index = 2

        mix_index = max(0, mix - 1) if mix > 0 else 0
        if self._needs_single_index(actual_path):
            return ch_index, 0
        return ch_index, mix_index

    def _param_key(self, actual_path: str, channel: int, mix: int) -> str:
        ch_index, mix_index = self._resolve_indices(actual_path, channel, mix)
        if actual_path.startswith("St/") or actual_path.startswith("Mono/"):
            return f"MIXER:Current/{actual_path} 0 0"
        if self._needs_single_index(actual_path):
            return f"MIXER:Current/{actual_path} {ch_index} 0"
        return f"MIXER:Current/{actual_path} {ch_index} {mix_index}"

    async def send_command(self, rcp_path: str, channel: int, value: str, mix: int = 0, is_fade_step: bool = False):
        """
        Compile and queue a Yamaha RCP set command.
        Example: send_command('InCh/Fader/Level', 1, '-1000') -> 'set MIXER:Current/InCh/Fader/Level 0 0 -1000\\n'
        """
        # Cancel any active fade for this parameter if we are setting it directly
        if not is_fade_step:
            fade_key = f"{rcp_path}_{channel}_{mix}"
            if fade_key in self._active_fades and not self._active_fades[fade_key].done():
                self._active_fades[fade_key].cancel()

        if rcp_path.startswith("ssrecall_ex"):
            cmd = f"ssrecall_ex scene_a {value}"
        else:
            actual_path = self._translate_path(rcp_path)
            key = self._param_key(actual_path, channel, mix)
            cmd = f"set {key} {value}"

        await self.send_raw(cmd)

    async def request_value(self, rcp_path: str, channel: int, mix: int = 0, timeout: float = 2.0) -> Optional[int]:
        """
        Send a 'get' command and wait for the 'OK' response.
        Returns the integer value, or None if timed out.
        """
        actual_path = self._translate_path(rcp_path)
        key = self._param_key(actual_path, channel, mix)

        async with self._request_lock:
            loop = asyncio.get_running_loop()
            future = loop.create_future()
            self._pending_requests[key] = future

            cmd = f"get {key}"
            await self.send_raw(cmd)

            try:
                val_str = await asyncio.wait_for(future, timeout)
                return int(val_str)
            except (asyncio.TimeoutError, ValueError):
                return None
            finally:
                self._pending_requests.pop(key, None)

    async def fade_command(self, rcp_path: str, channel: int, mix: int, start_val: int, end_val: int, duration_ms: int):
        """
        Smoothly fades a parameter from start_val to end_val over duration_ms.
        """
        fade_key = f"{rcp_path}_{channel}_{mix}"
        
        # Cancel any existing fade for this exact parameter
        if fade_key in self._active_fades and not self._active_fades[fade_key].done():
            self._active_fades[fade_key].cancel()
            
        async def _fade_loop():
            try:
                # Calculate steps (aim for ~20 updates per second -> 50ms per step)
                step_duration_ms = 50
                total_steps = max(1, duration_ms // step_duration_ms)
                actual_step_sleep = duration_ms / total_steps / 1000.0
                
                delta = end_val - start_val
                
                for step in range(total_steps):
                    current_val = start_val + int((step / total_steps) * delta)
                    await self.send_command(rcp_path, channel, str(current_val), mix, is_fade_step=True)
                    await asyncio.sleep(actual_step_sleep)
                    
                # Ensure the final exact value is sent
                await self.send_command(rcp_path, channel, str(end_val), mix, is_fade_step=True)
            except asyncio.CancelledError:
                # Fade was interrupted by another fade
                pass
            finally:
                if fade_key in self._active_fades and self._active_fades[fade_key] == asyncio.current_task():
                    del self._active_fades[fade_key]
                    
        self._active_fades[fade_key] = asyncio.create_task(_fade_loop())

    def cancel_fade(self, rcp_path: str, channel: int, mix: int = 0):
        """Cancel an in-progress fade for the given parameter."""
        fade_key = f"{rcp_path}_{channel}_{mix}"
        task = self._active_fades.get(fade_key)
        if task and not task.done():
            task.cancel()

    async def await_fade(self, rcp_path: str, channel: int, mix: int = 0):
        """Wait for the active fade on this parameter to finish (or be cancelled)."""
        fade_key = f"{rcp_path}_{channel}_{mix}"
        task = self._active_fades.get(fade_key)
        if task and not task.done():
            try:
                await task
            except asyncio.CancelledError:
                pass

    async def send_raw(self, cmd: str):
        """Push a raw command string to the write queue."""
        formatted_cmd = f"{cmd}\n"
        await self._command_queue.put(formatted_cmd)

    async def _write_loop(self):
        """Process the queue and send commands down the socket safely."""
        try:
            while self.connected and self.writer:
                cmd = await self._command_queue.get()
                
                try:
                    logger.debug(f"Yamaha TX: {cmd.strip()}")
                    self.writer.write(cmd.encode('utf-8'))
                    await self.writer.drain()
                except Exception as e:
                    logger.error(f"Error writing to Yamaha: {e}")
                    await self._handle_disconnect()
                    break
                    
                self._command_queue.task_done()
        except asyncio.CancelledError:
            pass

    async def _read_loop(self):
        """Read and parse responses from the Yamaha mixer."""
        try:
            while self.connected and self.reader:
                line = await self.reader.readline()
                if not line:
                    logger.warning("Yamaha connection closed by mixer.")
                    break
                
                decoded_line = line.decode('utf-8', errors='ignore').strip()
                if decoded_line:
                    logger.debug(f"Yamaha RX: {decoded_line}")
                    await self._parse_incoming(decoded_line)
                    
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Yamaha read loop error: {e}")
            
        await self._handle_disconnect()

    async def _parse_incoming(self, line: str):
        """Parse incoming lines from the mixer."""
        parts = line.split()
        if not parts:
            return

        msg_type = parts[0]
        
        # ── Streaming Meter NOTIFY ──
        # NOTIFY mtr MIXER:Current/InCh/PostOn level 21 20 20 1f 1e 1c 24 ...
        if msg_type == 'NOTIFY' and len(parts) > 4 and parts[1] == 'mtr' and parts[3] == 'level':
            meter_addr = parts[2]
            if '/InCh/' not in meter_addr and '/Meter/InCh' not in meter_addr:
                return
            if self._meter_callback and self._monitored_channels:
                try:
                    # parts[4] is ch1, parts[5] is ch2, etc. (hex strings, 0–127 index)
                    hex_values = parts[4:]
                    for ch in self._monitored_channels:
                        ch_idx = ch - 1  # 0-based
                        if 0 <= ch_idx < len(hex_values):
                            idx_val = int(hex_values[ch_idx], 16)
                            db_level = METER_TABLE.get(idx_val, -32768)

                            self._meter_received_count += 1
                            if self._meter_received_count <= 5:
                                logger.info(
                                    f"[METER STREAM] ch={ch}, idx={idx_val}, db_level={db_level} ({db_level / 100:.1f} dB)"
                                )

                            asyncio.create_task(self._meter_callback(ch, db_level))
                except Exception as e:
                    logger.warning(f"[METER STREAM PARSE ERROR] Could not parse meter line: '{line[:80]}' — {e}")
            return

        # ── Parameter NOTIFY (from devstatus subscription or direct NOTIFY) ──
        # Possible formats:
        #   NOTIFY set MIXER:Current/InCh/Fader/Level 0 0 -3200
        #   NOTIFY MIXER:Current/InCh/Fader/Level 0 0 -3200
        if msg_type == 'NOTIFY' and 'Meter/Level' not in line and parts[1] != 'mtr':
            # This handles Fader/Level and other state changes
            pass
            
        # ── OK Responses (for request_value AND meter polling) ──
        # OK get MIXER:Current/InCh/Meter/Level 0 0 -3200
        # OK MIXER:Current/InCh/Fader/Level 0 0 -1000
        if msg_type == 'OK':
            # Try to match pending requests first
            if len(parts) >= 5:
                # Try format: OK MIXER:... ch mix val
                key = f"{parts[1]} {parts[2]} {parts[3]}"
                if key in self._pending_requests and not self._pending_requests[key].done():
                    self._pending_requests[key].set_result(parts[4])
                    return
            if len(parts) >= 6:
                # Try format: OK get MIXER:... ch mix val  (some firmwares include the verb)
                key = f"{parts[2]} {parts[3]} {parts[4]}"
                if key in self._pending_requests and not self._pending_requests[key].done():
                    self._pending_requests[key].set_result(parts[5])
                    return

            # If it's a meter OK response (from our polling), feed it to the meter callback
            if 'Meter/Level' in line and self._meter_callback:
                try:
                    level = int(parts[-1])
                    ch_index = int(parts[-3])
                    self._meter_received_count += 1
                    if self._meter_received_count <= 5:
                        logger.info(f"[METER POLL OK] ch_index={ch_index} -> ch_1based={ch_index + 1}, level={level}")
                    await self._meter_callback(ch_index + 1, level)
                except (ValueError, IndexError) as e:
                    logger.warning(f"[METER POLL PARSE ERROR] Could not parse OK meter line: '{line}' — {e}")
            return
        
        # ── OKm (meter-specific short response from some firmwares) ──
        if msg_type == 'OKm' and self._meter_callback:
            try:
                level = int(parts[-1])
                ch_index = int(parts[-3])
                await self._meter_callback(ch_index + 1, level)
            except (ValueError, IndexError):
                pass
            return

    async def _request_meter_stream(self):
        """Request live input meter NOTIFY stream (TF: mtrinfo → mtrstart InCh/PostOn)."""
        cmd = f"mtrstart {METER_STREAM_PATH} {METER_INTERVAL_MS}"
        await self.send_raw(cmd)
        logger.info(f"Sent '{cmd}' to Yamaha TF3")

    def _start_meter_keepalive(self):
        if self._meter_keepalive_task and not self._meter_keepalive_task.done():
            return
        self._meter_keepalive_task = asyncio.create_task(self._meter_keepalive_loop())

    async def _meter_keepalive_loop(self):
        """Re-request meter stream before Yamaha's 10-second transmission window expires."""
        try:
            while self.connected:
                await asyncio.sleep(METER_KEEPALIVE_SEC)
                if self.connected and self._monitored_channels:
                    await self._request_meter_stream()
        except asyncio.CancelledError:
            pass

    def set_monitored_channels(self, channels: set):
        """Update the set of channels to receive meter NOTIFY data for."""
        prev = self._monitored_channels
        self._monitored_channels = set(channels)
        if channels != prev:
            logger.info(f"Yamaha meter stream active for channels: {sorted(channels)}")
            if self.connected and channels:
                asyncio.create_task(self._request_meter_stream())

    async def _handle_disconnect(self):
        """Clean up and trigger reconnect."""
        if self.connected:
            await self.disconnect()
            # Automatically attempt to reconnect
            asyncio.create_task(self.connect())
