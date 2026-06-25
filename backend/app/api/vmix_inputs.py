from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

from app.drivers import vmix_http, vmix_tcp
from app.engine.trigger_engine import engine

router = APIRouter(prefix="/vmix", tags=["vMix"])

@router.get("/inputs")
async def get_vmix_inputs() -> List[Dict[str, Any]]:
    """
    Proxy to vMix HTTP API to fetch all active inputs.
    Used to populate dropdowns in the frontend dashboard.
    """
    try:
        inputs = await vmix_http.get_inputs()
        return inputs
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to communicate with vMix HTTP API: {str(e)}")

@router.get("/status")
async def get_vmix_status() -> Dict[str, Any]:
    """Return the current connection status of the vMix TCP Client."""
    return {
        "connected": engine.vmix_connected,
        "reconnecting": vmix_tcp.reconnecting
    }
