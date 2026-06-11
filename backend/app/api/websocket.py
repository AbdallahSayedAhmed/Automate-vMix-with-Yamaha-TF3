from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
import logging

from app.engine.trigger_engine import engine
from app.drivers import vmix_tcp, yamaha_tcp

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["WebSockets"])

class ConnectionManager:
    """Manages active websocket connections to the dashboard."""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # Send initial connection state and log history
        await websocket.send_json({
            "type": "STATUS_UPDATE",
            "data": {
                "vmix_connected": engine.vmix_connected,
                "yamaha_connected": engine.yamaha_connected
            }
        })
        
        await websocket.send_json({
            "type": "LOG_HISTORY",
            "data": list(engine.execution_log)
        })

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_status(self, vmix_connected: bool, yamaha_connected: bool):
        message = {
            "type": "STATUS_UPDATE",
            "data": {
                "vmix_connected": vmix_connected,
                "yamaha_connected": yamaha_connected
            }
        }
        await self._broadcast(message)

    async def broadcast_log(self, log_entry: Dict[str, Any]):
        message = {
            "type": "NEW_LOG",
            "data": log_entry
        }
        await self._broadcast(message)

    async def broadcast_meter(self, channel: int, level: int):
        await self._broadcast({
            "type": "METER_UPDATE",
            "data": {"channel": channel, "level": level}
        })
        
    async def broadcast_trigger(self, rule_id: int):
        await self._broadcast({
            "type": "RULE_TRIGGERED",
            "data": {"rule_id": rule_id}
        })

    async def broadcast_action_state(self, payload: Dict[str, Any]):
        await self._broadcast({
            "type": "ACTION_STATE_UPDATE",
            "data": payload
        })

    async def _broadcast(self, message: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except RuntimeError:
                # Connection might be dropped
                dead_connections.append(connection)
                
        for dead in dead_connections:
            self.disconnect(dead)

ws_manager = ConnectionManager()

# Hook the engine logs to websocket broadcasts
async def on_engine_log(log_entry: Dict[str, Any]):
    await ws_manager.broadcast_log(log_entry)

# Hook the connection status to websocket broadcasts
async def on_vmix_status_changed(is_connected: bool):
    await engine.handle_vmix_status(is_connected)
    await ws_manager.broadcast_status(engine.vmix_connected, engine.yamaha_connected)

async def on_yamaha_status_changed(is_connected: bool):
    await engine.handle_yamaha_status(is_connected)
    if is_connected:
        await engine._sync_monitored_channels()
    await ws_manager.broadcast_status(engine.vmix_connected, engine.yamaha_connected)

# Register callbacks
engine.add_log_callback(on_engine_log)
vmix_tcp.set_callbacks(on_event=engine.ingest_vmix_event, on_status_change=on_vmix_status_changed)
yamaha_tcp.set_status_callback(on_status_change=on_yamaha_status_changed)
yamaha_tcp.set_meter_callback(cb=engine.handle_yamaha_meter)


@router.websocket("/status")
async def websocket_status_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for the React dashboard to receive
    live logs and connection status updates.
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            # We just keep connection open, optionally reading ping/pongs
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
