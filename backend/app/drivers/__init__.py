from app.drivers.vmix_client import VMixTCPClient
from app.drivers.vmix_http import VMixHTTPClient
from app.drivers.yamaha_rcp_client import YamahaRCPClient
from app.core.config import settings

# Instantiate singletons that will be used across the application
vmix_tcp = VMixTCPClient(host=settings.vmix_host, port=settings.vmix_tcp_port)
vmix_http = VMixHTTPClient(host=settings.vmix_host, port=settings.vmix_http_port)
yamaha_tcp = YamahaRCPClient(host=settings.yamaha_host, port=settings.yamaha_port)
