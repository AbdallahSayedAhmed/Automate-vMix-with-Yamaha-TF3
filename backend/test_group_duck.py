import pytest
import asyncio
import time
from unittest.mock import AsyncMock

from app.engine.group_duck_engine import (
    GroupDuckEngine,
    make_target_key,
    member_to_action_dict,
    _parse_rule_fade,
)


@pytest.fixture
def gde():
    return GroupDuckEngine()


def _member_dict(mid=1, ch=1, target_ch=10):
    m = {
        "monitor_channel": ch,
        "threshold": -4000,
        "release_threshold": -5000,
        "action_target": "yamaha",
        "yamaha_command": "InCh/Fader/Smooth",
        "yamaha_channel": target_ch,
        "yamaha_mix": 0,
        "parameter_value": "-2500",
    }
    return {
        "id": mid,
        "group_id": 1,
        "monitor_channel": ch,
        "threshold": -4000,
        "release_threshold": -5000,
        "action": member_to_action_dict(m, mid, 1, 700, 700),
    }


def _group(silence=100):
    return {"id": 1, "name": "Test Group", "silence_timeout_ms": silence}


def test_negative_level_is_not_used_as_fade_duration():
    assert _parse_rule_fade("-11000,3000") == (700, 3000)


def test_level_member_keeps_plain_apply_value():
    m = {
        "monitor_channel": 1,
        "action_target": "yamaha",
        "yamaha_command": "InCh/Fader/Level",
        "yamaha_channel": 8,
        "yamaha_mix": 0,
        "parameter_value": "-10000",
    }

    action = member_to_action_dict(m, 1000, 1, 700, 3000)

    assert action["parameter_value"] == "-10000"


@pytest.mark.asyncio
async def test_per_target_restore_when_one_mic_stops(gde):
    m1 = _member_dict(1001, ch=1, target_ch=10)
    m2 = _member_dict(1002, ch=2, target_ch=15)
    g = _group()
    gde._channel_index = {1: [(g, m1)], 2: [(g, m2)]}
    gde._cache_ts = time.time()

    engine = AsyncMock()
    engine._capture_action_value = AsyncMock(return_value=0)
    engine._apply_meter_action = AsyncMock()
    engine._add_log = AsyncMock()
    engine._broadcast_meter = AsyncMock()

    await gde.handle_meter(1, -3000, engine)
    await asyncio.sleep(0.05)
    assert gde._target_rt[make_target_key(m1["action"])]["status"] == "active"

    await gde.handle_meter(2, -3000, engine)
    await asyncio.sleep(0.05)
    assert gde._target_rt[make_target_key(m2["action"])]["status"] == "active"

    await gde.handle_meter(1, -6000, engine)
    await asyncio.sleep(0.15)
    await gde.handle_meter(1, -6000, engine)

    assert gde._target_rt[make_target_key(m1["action"])]["status"] == "idle"
    assert gde._target_rt[make_target_key(m2["action"])]["status"] == "active"


@pytest.mark.asyncio
async def test_shared_target_dedup_two_mics(gde):
    m1 = _member_dict(1001, ch=1, target_ch=10)
    m2 = _member_dict(1002, ch=2, target_ch=10)
    g = _group()
    gde._channel_index = {1: [(g, m1)], 2: [(g, m2)]}
    gde._cache_ts = time.time()

    engine = AsyncMock()
    engine._capture_action_value = AsyncMock(return_value=0)
    engine._apply_meter_action = AsyncMock()
    engine._add_log = AsyncMock()
    engine._broadcast_meter = AsyncMock()

    await gde.handle_meter(1, -3000, engine)
    await asyncio.sleep(0.05)
    key = make_target_key(m1["action"])
    assert engine._capture_action_value.call_count == 1

    await gde.handle_meter(2, -3000, engine)
    await asyncio.sleep(0.05)
    assert len(gde._target_rt[key]["contributors"]) == 2

    await gde.handle_meter(1, -6000, engine)
    await asyncio.sleep(0.15)
    assert len(gde._target_rt[key]["contributors"]) == 1

    await gde.handle_meter(2, -6000, engine)
    await asyncio.sleep(0.15)
    assert gde._target_rt[key]["status"] == "idle"


@pytest.mark.asyncio
async def test_multi_duck_applies_even_when_snapshot_capture_fails(gde):
    m1 = _member_dict(1001, ch=1, target_ch=10)
    g = _group()
    gde._channel_index = {1: [(g, m1)]}
    gde._cache_ts = time.time()

    engine = AsyncMock()
    engine._capture_action_value = AsyncMock(return_value=None)
    engine._apply_meter_action = AsyncMock()
    engine._add_log = AsyncMock()
    engine._broadcast_meter = AsyncMock()

    await gde.handle_meter(1, -3000, engine)
    await asyncio.sleep(0.05)

    key = make_target_key(m1["action"])
    assert gde._target_rt[key]["status"] == "active"
    assert gde._target_rt[key]["saved_value"] is None
    engine._apply_meter_action.assert_called_once()
