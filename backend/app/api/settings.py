import asyncio
import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any

from app.core.config import settings
from app.drivers import vmix_tcp, vmix_http, yamaha_tcp

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])

class SettingsResponse(BaseModel):
    vmix_host: str
    vmix_tcp_port: int
    vmix_http_port: int
    yamaha_host: str
    yamaha_port: int
    
class SettingsUpdate(SettingsResponse):
    pass

@router.get("/", response_model=SettingsResponse)
async def get_app_settings():
    """Return the current connection configuration."""
    return SettingsResponse(
        vmix_host=settings.vmix_host,
        vmix_tcp_port=settings.vmix_tcp_port,
        vmix_http_port=settings.vmix_http_port,
        yamaha_host=settings.yamaha_host,
        yamaha_port=settings.yamaha_port
    )

@router.put("/", response_model=SettingsResponse)
async def update_app_settings(new_settings: SettingsUpdate):
    """
    Update the connection targets at runtime and reconnect drivers.
    Disconnects existing TCP connections, updates host/port on driver
    instances, then fires background reconnect tasks.
    """
    logger.info(f"Updating settings — vMix: {new_settings.vmix_host}:{new_settings.vmix_tcp_port}, "
                f"Yamaha: {new_settings.yamaha_host}:{new_settings.yamaha_port}")

    # 1. Update the global settings singleton
    settings.vmix_host = new_settings.vmix_host
    settings.vmix_tcp_port = new_settings.vmix_tcp_port
    settings.vmix_http_port = new_settings.vmix_http_port
    settings.yamaha_host = new_settings.yamaha_host
    settings.yamaha_port = new_settings.yamaha_port

    # 2. Disconnect existing driver connections
    await vmix_tcp.disconnect()
    await yamaha_tcp.disconnect()

    # 3. Update driver instance connection targets
    vmix_tcp.host = new_settings.vmix_host
    vmix_tcp.port = new_settings.vmix_tcp_port
    vmix_http.base_url = f"http://{new_settings.vmix_host}:{new_settings.vmix_http_port}/api/"
    yamaha_tcp.host = new_settings.yamaha_host
    yamaha_tcp.port = new_settings.yamaha_port

    # 4. Reconnect in background
    asyncio.create_task(vmix_tcp.connect())
    asyncio.create_task(yamaha_tcp.connect())

    return await get_app_settings()
