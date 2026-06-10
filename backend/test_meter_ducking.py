import pytest
import asyncio
import time
from unittest.mock import AsyncMock, patch

from app.engine.trigger_engine import TriggerEngine


@pytest.fixture
def engine():
    return TriggerEngine()


def _meter_rule(rule_id=1, ch=1, cmd="InCh/Fader/On", param="0"):
    return {
        "id": rule_id,
        "name": "Mic Duck",
        "sort_order": 0,
        "listen_source": "yamaha",
        "trigger_event": "YamahaMeter",
        "vmix_input_number": ch,
        "threshold": -4000,
        "release_threshold": -5000,
        "silence_timeout_ms": 100,
        "time_threshold": None,
        "action_target": "yamaha",
        "yamaha_command": cmd,
        "yamaha_channel": 6,
        "yamaha_mix": 0,
        "vmix_function": None,
        "vmix_target_input": None,
        "parameter_value": param,
        "delay_ms": 0,
    }


@pytest.mark.asyncio
async def test_meter_on_off_cycles_save_and_restore(engine):
    rule = _meter_rule(cmd="InCh/Fader/On", param="0")
    engine.rules_cache["yamaha_YamahaMeter_1"] = {
        "timestamp": time.time(),
        "rules": [rule],
    }

    with patch.object(engine, "_broadcast_meter", new_callable=AsyncMock), \
         patch.object(engine, "_capture_action_value", new_callable=AsyncMock, return_value=1), \
         patch.object(engine, "_apply_meter_action", new_callable=AsyncMock) as apply_action, \
         patch.object(engine, "_add_log", new_callable=AsyncMock):

        await engine.handle_yamaha_meter(1, -3000)
        await asyncio.sleep(0.05)

        state = engine._get_meter_state(1)
        assert state["status"] == "active"
        assert state["saved_value"] == 1
        apply_action.assert_called_with(rule, "0", is_restore=False, saved_start=1)

        apply_action.reset_mock()
        await asyncio.sleep(0.12)
        await engine.handle_yamaha_meter(1, -6000)
        await asyncio.sleep(0.05)

        assert state["status"] == "idle"
        assert state["saved_value"] is None
        apply_action.assert_called_with(rule, 1, is_restore=True)


@pytest.mark.asyncio
async def test_meter_re_attack_after_restore(engine):
    rule = _meter_rule()
    engine.rules_cache["yamaha_YamahaMeter_1"] = {
        "timestamp": time.time(),
        "rules": [rule],
    }

    with patch.object(engine, "_broadcast_meter", new_callable=AsyncMock), \
         patch.object(engine, "_capture_action_value", new_callable=AsyncMock, return_value=1), \
         patch.object(engine, "_apply_meter_action", new_callable=AsyncMock), \
         patch.object(engine, "_add_log", new_callable=AsyncMock):

        await engine.handle_yamaha_meter(1, -3000)
        await asyncio.sleep(0.05)
        await engine.handle_yamaha_meter(1, -6000)
        await asyncio.sleep(0.15)
        await engine.handle_yamaha_meter(1, -3000)
        await asyncio.sleep(0.05)

        state = engine._get_meter_state(1)
        assert state["status"] == "active"
        assert state["saved_value"] == 1
