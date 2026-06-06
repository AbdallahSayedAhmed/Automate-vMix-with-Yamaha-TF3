import httpx
import logging
from lxml import etree
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class VMixHTTPClient:
    """
    HTTP client to query the vMix Web API (Port 8088).
    Used primarily for fetching the current state (inputs, titles, etc)
    to hydrate the frontend dashboard.
    """
    def __init__(self, host: str, port: int):
        self.base_url = f"http://{host}:{port}/api/"

    async def fetch_xml_state(self) -> bytes:
        """Fetch the full XML state from vMix."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(self.base_url, timeout=5.0)
                response.raise_for_status()
                return response.content
            except httpx.RequestError as e:
                logger.error(f"vMix HTTP API request failed: {e}")
                return b""

    async def get_inputs(self) -> List[Dict[str, Any]]:
        """
        Parse the XML state and return a list of active inputs.
        Useful for dropdowns in the frontend.
        """
        xml_data = await self.fetch_xml_state()
        if not xml_data:
            return []

        inputs_list = []
        try:
            root = etree.fromstring(xml_data)
            # Find all <input> elements within <inputs>
            for input_elem in root.xpath("//inputs/input"):
                input_data = {
                    "key": input_elem.get("key"),
                    "number": int(input_elem.get("number")),
                    "type": input_elem.get("type"),
                    "title": input_elem.get("title"),
                    "state": input_elem.get("state"),
                    "duration": int(input_elem.get("duration")) if input_elem.get("duration") else 0,
                    "position": int(input_elem.get("position")) if input_elem.get("position") else 0,
                }
                inputs_list.append(input_data)
        except Exception as e:
            logger.error(f"Error parsing vMix XML: {e}")

        return inputs_list
