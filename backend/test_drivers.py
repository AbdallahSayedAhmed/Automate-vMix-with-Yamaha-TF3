import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from app.drivers.vmix_client import VMixTCPClient
from app.drivers.yamaha_rcp_client import YamahaRCPClient
from app.drivers.vmix_http import VMixHTTPClient

@pytest.mark.asyncio
async def test_vmix_tcp_client_connect_and_subscribe():
    client = VMixTCPClient("127.0.0.1", 8099)
    
    # Mock asyncio.open_connection
    mock_reader = AsyncMock()
    mock_writer = AsyncMock()
    
    with patch("asyncio.open_connection", return_value=(mock_reader, mock_writer)):
        # Start connection process
        await client.connect()
        
        # Verify it attempted to connect and sent subscriptions
        assert client.connected is True
        mock_writer.write.assert_any_call(b"SUBSCRIBE TALLY\r\n")
        mock_writer.write.assert_any_call(b"SUBSCRIBE ACTS\r\n")
        
        await client.disconnect()
        assert client.connected is False

@pytest.mark.asyncio
async def test_yamaha_rcp_client_formatting():
    client = YamahaRCPClient("192.168.1.128", 49280)
    
    # Send standard command
    await client.send_command("InCh/Fader/Level", 1, "-1000")
    queued_cmd = await client._command_queue.get()
    assert queued_cmd == "set MIXER:Current/InCh/Fader/Level 1 0 -1000\n"
    
    # Send ssrecall_ex
    await client.send_command("ssrecall_ex", 0, "Scene2")
    queued_cmd2 = await client._command_queue.get()
    assert queued_cmd2 == "ssrecall_ex Scene2 0 0 0 0 0\n"

@pytest.mark.asyncio
async def test_vmix_http_parsing():
    client = VMixHTTPClient("127.0.0.1", 8088)
    
    mock_xml = b'''
    <vmix>
        <inputs>
            <input key="1234" number="1" type="Camera" title="Cam 1" state="Running"/>
            <input key="5678" number="2" type="Video" title="VTR 1" state="Paused"/>
        </inputs>
    </vmix>
    '''
    
    with patch.object(client, 'fetch_xml_state', return_value=mock_xml):
        inputs = await client.get_inputs()
        assert len(inputs) == 2
        assert inputs[0]["number"] == 1
        assert inputs[0]["title"] == "Cam 1"
        assert inputs[1]["type"] == "Video"
