import asyncio
import logging
import traceback
from typing import Callable, Optional, Awaitable, Dict

logger = logging.getLogger(__name__)

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
        
        self._read_task: Optional[asyncio.Task] = None
        self._write_task: Optional[asyncio.Task] = None
        
        self._base_delay = 1.0
        self._max_delay = 30.0

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

                # Subscribe to channel input meter NOTIFY events
                await self.send_raw("subscribe NOTIFY MIXER:Current/InCh/Meter/Level")

                # Start the IO loops
                self._read_task = asyncio.create_task(self._read_loop())
                self._write_task = asyncio.create_task(self._write_loop())
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
                actual_path.startswith("St/"))

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
            ch_index = max(0, channel - 1)
            mix_index = max(0, mix - 1) if mix > 0 else 0
            actual_path = self._translate_path(rcp_path)
            
            # TF series FX Returns are stereo pairs (0=FX1 L, 1=FX1 R, 2=FX2 L, 3=FX2 R)
            # Map user-friendly channels (1=FX1, 2=FX2) directly to the Left channels
            if actual_path.startswith("FxRtnCh/"):
                if channel == 1: ch_index = 0
                elif channel == 2: ch_index = 2
            
            if actual_path.startswith("St/"):
                cmd = f"set MIXER:Current/{actual_path} 0 0 {value}"
            elif self._needs_single_index(actual_path):
                cmd = f"set MIXER:Current/{actual_path} {ch_index} 0 {value}"
            else:
                cmd = f"set MIXER:Current/{actual_path} {ch_index} {mix_index} {value}"
            
        await self.send_raw(cmd)

    async def request_value(self, rcp_path: str, channel: int, mix: int = 0, timeout: float = 2.0) -> Optional[int]:
        """
        Send a 'get' command and wait for the 'OK' response.
        Returns the integer value, or None if timed out.
        """
        ch_index = max(0, channel - 1)
        mix_index = max(0, mix - 1) if mix > 0 else 0
        actual_path = self._translate_path(rcp_path)
        
        # TF series FX Returns are stereo pairs (0=FX1 L, 1=FX1 R, 2=FX2 L, 3=FX2 R)
        if actual_path.startswith("FxRtnCh/"):
            if channel == 1: ch_index = 0
            elif channel == 2: ch_index = 2
        
        if actual_path.startswith("St/"):
            key = f"MIXER:Current/{actual_path} 0 0"
        elif self._needs_single_index(actual_path):
            key = f"MIXER:Current/{actual_path} {ch_index} 0"
        else:
            key = f"MIXER:Current/{actual_path} {ch_index} {mix_index}"
        
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
        
        # ── Meter NOTIFY ──
        # NOTIFY MIXER:Current/InCh/Meter/Level 0 0 -3200
        if msg_type == 'NOTIFY' and 'Meter/Level' in line:
            if self._meter_callback:
                try:
                    ch_index = int(parts[-3])
                    level = int(parts[-1])
                    await self._meter_callback(ch_index + 1, level)
                except (ValueError, IndexError):
                    pass
            return
            
        # ── OK Responses (for request_value) ──
        # OK MIXER:Current/InCh/Fader/Level 0 0 -1000
        if msg_type == 'OK' and len(parts) >= 5:
            # Reconstruct the key to match what we sent in 'get'
            # parts[1] = path, parts[2] = ch, parts[3] = mix, parts[4] = val
            key = f"{parts[1]} {parts[2]} {parts[3]}"
            if key in self._pending_requests and not self._pending_requests[key].done():
                self._pending_requests[key].set_result(parts[4])

    async def _handle_disconnect(self):
        """Clean up and trigger reconnect."""
        if self.connected:
            await self.disconnect()
            # Automatically attempt to reconnect
            asyncio.create_task(self.connect())
