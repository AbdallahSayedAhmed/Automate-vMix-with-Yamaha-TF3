import asyncio
import pytest

from app.drivers.yamaha_rcp_client import YamahaRCPClient


@pytest.mark.asyncio
async def test_meter_notify_parses_hex_levels():
    client = YamahaRCPClient("192.168.1.128", 49280)
    received = []

    async def on_meter(ch, level):
        received.append((ch, level))

    client.set_meter_callback(on_meter)
    client.set_monitored_channels({1, 8})

    # TF meters are raw dB values offset by 126, so 0x2e = -80 dB.
    line = "NOTIFY mtr MIXER:Current/InCh/PostOn level 2e 00 00 00"
    await client._parse_incoming(line)
    await asyncio.sleep(0.05)

    assert received == [(1, -8000)]


@pytest.mark.asyncio
async def test_meter_notify_parses_hex_levels_without_level_keyword():
    client = YamahaRCPClient("192.168.1.128", 49280)
    received = []

    async def on_meter(ch, level):
        received.append((ch, level))

    client.set_meter_callback(on_meter)
    client.set_monitored_channels({2})

    line = "NOTIFY mtr MIXER:Current/InCh/PostOn 00 2e 00 00"
    await client._parse_incoming(line)
    await asyncio.sleep(0.05)

    assert received == [(2, -8000)]


@pytest.mark.asyncio
async def test_meter_stream_request_uses_tf_mtrstart():
    client = YamahaRCPClient("192.168.1.128", 49280)

    await client._request_meter_stream()

    assert await client._command_queue.get() == "mtrstart MIXER:Current/InCh/PostOn 100\n"


def test_tf_meter_index_to_centidb():
    client = YamahaRCPClient("192.168.1.128", 49280)

    assert client._tf_meter_index_to_centidb(0x00) == -12600
    assert client._tf_meter_index_to_centidb(0x7E) == 0
    assert client._tf_meter_index_to_centidb(0x7F) == 100


@pytest.mark.asyncio
async def test_meter_notify_ignored_without_monitored_channels():
    client = YamahaRCPClient("192.168.1.128", 49280)
    received = []

    async def on_meter(ch, level):
        received.append((ch, level))

    client.set_meter_callback(on_meter)
    client.set_monitored_channels(set())

    line = "NOTIFY mtr MIXER:Current/InCh/PostOn level 2e 00 00 00"
    await client._parse_incoming(line)

    assert received == []
