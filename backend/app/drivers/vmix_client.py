import asyncio
import logging
import traceback
from typing import Callable, Optional, Awaitable

logger = logging.getLogger(__name__)

class VMixTCPClient:
    """
    Asynchronous TCP client for vMix (Port 8099).
    Maintains a persistent connection, subscribes to events,
    and dispatches parsed messages to a callback.
    """
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None
        self.connected = False
        self.reconnecting = False
        self._on_event_callback: Optional[Callable[[str], Awaitable[None]]] = None
        self._on_status_callback: Optional[Callable[[bool], Awaitable[None]]] = None
        self._task: Optional[asyncio.Task] = None
        
        # Reconnect parameters
        self._base_delay = 1.0
        self._max_delay = 30.0

    def set_callbacks(
        self, 
        on_event: Callable[[str], Awaitable[None]], 
        on_status_change: Callable[[bool], Awaitable[None]]
    ):
        self._on_event_callback = on_event
        self._on_status_callback = on_status_change

    async def connect(self):
        """Establish connection with exponential backoff."""
        if self.connected or self.reconnecting:
            return

        self.reconnecting = True
        delay = self._base_delay

        while self.reconnecting:
            try:
                logger.info(f"Connecting to vMix TCP at {self.host}:{self.port}...")
                self.reader, self.writer = await asyncio.open_connection(self.host, self.port)
                self.connected = True
                self.reconnecting = False
                logger.info("vMix TCP Connected.")
                
                if self._on_status_callback:
                    await self._on_status_callback(True)

                # Subscribe to Tally and Activators
                await self.send_command("SUBSCRIBE TALLY")
                await self.send_command("SUBSCRIBE ACTS")

                # Start reading loop
                self._task = asyncio.create_task(self._read_loop())
                return

            except (ConnectionRefusedError, TimeoutError, OSError) as e:
                logger.warning(f"vMix connection failed: {e}. Retrying in {delay}s...")
                await asyncio.sleep(delay)
                delay = min(delay * 2, self._max_delay)

    async def disconnect(self):
        """Close the connection cleanly."""
        self.reconnecting = False
        self.connected = False
        
        if self._task:
            self._task.cancel()
            
        if self.writer:
            try:
                self.writer.close()
                await self.writer.wait_closed()
            except Exception:
                pass
            
        self.writer = None
        self.reader = None
        logger.info("vMix TCP Disconnected.")
        
        if self._on_status_callback:
            await self._on_status_callback(False)

    async def send_command(self, cmd: str):
        """Send a raw command to vMix."""
        if not self.connected or not self.writer:
            logger.error("Cannot send to vMix: Not connected.")
            return

        formatted_cmd = f"{cmd}\r\n".encode('utf-8')
        try:
            self.writer.write(formatted_cmd)
            await self.writer.drain()
        except Exception as e:
            logger.error(f"Error sending to vMix: {e}")
            await self._handle_disconnect()

    async def _read_loop(self):
        """Continuously read lines from the TCP socket."""
        try:
            while self.connected and self.reader:
                line = await self.reader.readline()
                if not line:
                    logger.warning("vMix connection closed by server.")
                    break
                
                decoded_line = line.decode('utf-8', errors='ignore').strip()
                if decoded_line and self._on_event_callback:
                    try:
                        await self._on_event_callback(decoded_line)
                    except Exception as e:
                        logger.error(f"Error in vMix event callback: {e}")
                        traceback.print_exc()
                        
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"vMix read loop error: {e}")
            
        await self._handle_disconnect()

    async def _handle_disconnect(self):
        """Clean up and trigger reconnect."""
        if self.connected:
            await self.disconnect()
            # Automatically attempt to reconnect
            asyncio.create_task(self.connect())

# Singleton instance will be exported from __init__.py
