"""
Application settings loaded from environment variables.

All connection parameters for vMix and Yamaha TF3 are configurable
via environment variables or a `.env` file in the backend root.
"""

from pathlib import Path
import sys

from pydantic_settings import BaseSettings
from pydantic import Field


if getattr(sys, "frozen", False):
    RUNTIME_ROOT = Path(sys.executable).resolve().parent
else:
    RUNTIME_ROOT = Path(__file__).resolve().parents[2]

ENV_FILE = RUNTIME_ROOT / ".env"
DEFAULT_DATABASE_URL = f"sqlite+aiosqlite:///{(RUNTIME_ROOT / 'bridge.db').as_posix()}"


class Settings(BaseSettings):
    """Central configuration for the vMix ↔ Yamaha TF3 Bridge."""

    # ── Application ──────────────────────────────────────────────
    app_name: str = "vMix-Yamaha TF3 Bridge"
    debug: bool = False

    # ── Database ─────────────────────────────────────────────────
    database_url: str = Field(
        default=DEFAULT_DATABASE_URL,
        description="Async SQLAlchemy connection string for the SQLite database.",
    )

    # ── vMix Connection ──────────────────────────────────────────
    vmix_host: str = Field(
        default="127.0.0.1",
        description="IP address of the machine running vMix.",
    )
    vmix_tcp_port: int = Field(
        default=8099,
        description="TCP API port for vMix event subscriptions.",
    )
    vmix_http_port: int = Field(
        default=8088,
        description="HTTP Web API port for vMix state queries.",
    )

    # ── Yamaha TF3 Connection ────────────────────────────────────
    yamaha_host: str = Field(
        default="192.168.1.128",
        description="IP address of the Yamaha TF3 mixer on the network.",
    )
    yamaha_port: int = Field(
        default=49280,
        description="TCP port for Yamaha Remote Control Protocol.",
    )

    # ── Reconnect Strategy ───────────────────────────────────────
    reconnect_initial_delay: float = Field(
        default=1.0,
        description="Initial delay in seconds before first reconnect attempt.",
    )
    reconnect_max_delay: float = Field(
        default=30.0,
        description="Maximum delay in seconds between reconnect attempts.",
    )
    reconnect_backoff_factor: float = Field(
        default=2.0,
        description="Multiplicative factor for exponential backoff.",
    )

    # ── CORS ─────────────────────────────────────────────────────
    cors_origins: list[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"],
        description="Allowed origins for CORS (Vite dev server by default).",
    )

    model_config = {
        "env_file": str(ENV_FILE),
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


# Singleton instance — import this throughout the app
settings = Settings()
