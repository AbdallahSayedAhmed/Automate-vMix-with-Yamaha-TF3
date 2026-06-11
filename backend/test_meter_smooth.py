import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.engine.trigger_engine import TriggerEngine


@pytest.mark.asyncio
async def test_smooth_duck_uses_saved_start():
    engine = TriggerEngine()
    rule = {
        "id": 1,
        "name": "Smooth Duck",
        "action_target": "yamaha",
        "yamaha_command": "InCh/Fader/Smooth",
        "yamaha_channel": 8,
        "yamaha_mix": 0,
        "parameter_value": "-10000,3000",
    }

    mock_tcp = MagicMock()
    mock_tcp.connected = True
    mock_tcp.fade_command = AsyncMock()
    mock_tcp.cancel_fade = MagicMock()
    mock_tcp.request_value = AsyncMock(return_value=0)

    with patch("app.drivers.yamaha_tcp", mock_tcp), \
         patch.object(engine, "_add_log", new_callable=AsyncMock):
        await engine._apply_meter_action(rule, "-10000,3000", is_restore=False, saved_start=0)

    mock_tcp.fade_command.assert_called_once_with(
        "InCh/Fader/Level", 8, 0, 0, -10000, 3000
    )


@pytest.mark.asyncio
async def test_smooth_restore_awaits_fade():
    engine = TriggerEngine()
    rule = {
        "id": 1,
        "name": "Smooth Duck",
        "action_target": "yamaha",
        "yamaha_command": "InCh/Fader/Smooth",
        "yamaha_channel": 8,
        "yamaha_mix": 0,
        "parameter_value": "-10000,3000",
    }

    mock_tcp = MagicMock()
    mock_tcp.connected = True
    mock_tcp.fade_command = AsyncMock()
    mock_tcp.await_fade = AsyncMock()
    mock_tcp.cancel_fade = MagicMock()
    mock_tcp.request_value = AsyncMock(return_value=-5000)

    with patch("app.drivers.yamaha_tcp", mock_tcp), \
         patch.object(engine, "_add_log", new_callable=AsyncMock), \
         patch.object(engine, "_cancel_yamaha_fade", new_callable=AsyncMock):
        await engine._apply_meter_action(rule, 0, is_restore=True)

    mock_tcp.fade_command.assert_called_once_with(
        "InCh/Fader/Level", 8, 0, -5000, 0, 3000
    )
    mock_tcp.await_fade.assert_called_once()


@pytest.mark.asyncio
async def test_plain_level_restore_does_not_use_smooth_fade():
    engine = TriggerEngine()
    rule = {
        "id": 1,
        "name": "Level Duck",
        "action_target": "yamaha",
        "yamaha_command": "InCh/Fader/Level",
        "yamaha_channel": 8,
        "yamaha_mix": 0,
        "parameter_value": "-10000",
    }

    mock_tcp = MagicMock()
    mock_tcp.connected = True
    mock_tcp.send_command = AsyncMock()
    mock_tcp.fade_command = AsyncMock()
    mock_tcp.cancel_fade = MagicMock()

    with patch("app.drivers.yamaha_tcp", mock_tcp), \
         patch.object(engine, "_add_log", new_callable=AsyncMock):
        await engine._apply_meter_action(rule, -120, is_restore=True)

    mock_tcp.send_command.assert_called_once_with("InCh/Fader/Level", 8, "-120", 0)
    mock_tcp.fade_command.assert_not_called()
