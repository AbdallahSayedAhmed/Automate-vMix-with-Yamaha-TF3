import asyncio
import pytest
from unittest.mock import AsyncMock

from app.drivers.yamaha_rcp_client import YamahaRCPClient
from app.drivers.yamaha_meter_table import METER_TABLE


@pytest.mark.asyncio
async def test_meter_notify_parses_hex_levels():
    client = YamahaRCPClient("192.168.1.128", 49280)
    received = []

    async def on_meter(ch, level):
        received.append((ch, level))

    client.set_meter_callback(on_meter)
    client.set_monitored_channels({1, 8})

    # idx 0x2e (46) -> -40.0 dB (-4000 centidB) per Yamaha meter table
    line = "NOTIFY mtr MIXER:Current/InCh/PostOn level 2e 00 00 00"
    await client._parse_incoming(line)
    await asyncio.sleep(0.05)

    assert received == [(1, METER_TABLE[0x2E])]


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
