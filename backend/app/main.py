"""
FastAPI application factory with async lifespan management.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.database import engine as db_engine, Base
from app.api import triggers, websocket, vmix_inputs, settings as settings_api, duck_groups
import asyncio

from app.drivers import vmix_tcp, yamaha_tcp

import sys

if getattr(sys, 'frozen', False):
    APP_ROOT = Path(sys.executable).parent
    FRONTEND_DIST = APP_ROOT / "resources" / "app" / "dist"
else:
    APP_ROOT = Path(__file__).resolve().parents[2]
    FRONTEND_DIST = APP_ROOT / "frontend" / "dist"

FRONTEND_INDEX = FRONTEND_DIST / "index.html"


def _migrate_schema(connection):
    """
    Add columns to existing SQLite DBs without a full migration tool.
    Every column that exists in models.py MUST have a migration entry here
    so users upgrading from older installs don't get AttributeError crashes.
    """
    from sqlalchemy import text, inspect
    inspector = inspect(connection)
    if 'trigger_rules' not in inspector.get_table_names():
        return
    columns = {col['name'] for col in inspector.get_columns('trigger_rules')}

    migrations = [
        ('fire_count',            'INTEGER NOT NULL DEFAULT 0'),
        ('last_fired_at',         'DATETIME'),
        ('is_multi_duck',         'BOOLEAN NOT NULL DEFAULT 0'),
        ('duck_members',          'TEXT'),
        ('is_multi_action',       'BOOLEAN NOT NULL DEFAULT 0'),
        ('actions',               'TEXT'),
        # FIX — vmix_input_key / vmix_target_input_key were in the model but
        # never migrated; existing DBs crashed with AttributeError on startup.
        ('vmix_input_key',        'TEXT'),
        ('vmix_target_input_key', 'TEXT'),
        # Group columns
        ('group_id',              'TEXT'),
        ('group_name',            'TEXT'),
        ('group_color',           'TEXT'),
        # Other optional columns that may be missing in older DBs
        ('release_threshold',     'INTEGER'),
        ('vmix_input_name',       'TEXT'),
        ('time_threshold',        'TEXT'),
        ('silence_timeout_ms',    'INTEGER'),
        ('sort_order',            'INTEGER NOT NULL DEFAULT 0'),
        ('delay_ms',              'INTEGER NOT NULL DEFAULT 0'),
        ('vmix_function',         'TEXT'),
        ('vmix_target_input',     'INTEGER'),
    ]

    for col_name, col_type in migrations:
        if col_name not in columns:
            connection.execute(
                text(f'ALTER TABLE trigger_rules ADD COLUMN {col_name} {col_type}')
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[*] {settings.app_name} starting up...")
    print("   Initializing database tables...")
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_migrate_schema)

    print(f"   Connecting to vMix TCP   -> {settings.vmix_host}:{settings.vmix_tcp_port}")
    asyncio.create_task(vmix_tcp.connect())

    print(f"   Connecting to Yamaha TF3 -> {settings.yamaha_host}:{settings.yamaha_port}")
    asyncio.create_task(yamaha_tcp.connect())

    from app.engine.trigger_engine import engine as trigger_engine
    await trigger_engine.reload_rules()
    trigger_engine.start_xml_poller(settings.vmix_host, settings.vmix_http_port)

    async def _delayed_channel_sync():
        await asyncio.sleep(5.0)
        await trigger_engine._sync_monitored_channels()
    asyncio.create_task(_delayed_channel_sync())

    yield

    print(f"[*] {settings.app_name} shutting down...")
    await vmix_tcp.disconnect()
    await yamaha_tcp.disconnect()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description=(
            "Asynchronous middleware bridging vMix video production events "
            "to Yamaha TF3 digital mixer commands in real-time."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health", tags=["System"])
    async def health_check():
        return {
            "status": "ok",
            "service": settings.app_name,
            "version": "0.1.0",
            "install_root": str(APP_ROOT),
            "frontend_ready": FRONTEND_INDEX.is_file(),
        }

    app.include_router(triggers.router, prefix="/api")
    app.include_router(vmix_inputs.router, prefix="/api")
    app.include_router(settings_api.router, prefix="/api")
    app.include_router(duck_groups.router, prefix="/api")
    app.include_router(websocket.router)

    if FRONTEND_INDEX.is_file():
        assets_dir = FRONTEND_DIST / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/", include_in_schema=False)
        async def serve_frontend_index():
            return FileResponse(FRONTEND_DIST / "index.html")

        @app.get("/{path:path}", include_in_schema=False)
        async def serve_frontend_asset_or_index(path: str):
            target = FRONTEND_DIST / path
            if target.is_file():
                return FileResponse(target)
            if path.startswith(("api/", "ws/")):
                raise HTTPException(status_code=404)
            return FileResponse(FRONTEND_DIST / "index.html")
    else:
        @app.get("/", include_in_schema=False)
        async def frontend_not_available():
            raise HTTPException(status_code=503, detail=f"Frontend build missing: {FRONTEND_INDEX}")

        @app.get("/{path:path}", include_in_schema=False)
        async def frontend_asset_not_available(path: str):
            if path.startswith(("api/", "ws/")):
                raise HTTPException(status_code=404)
            raise HTTPException(status_code=503, detail=f"Frontend build missing: {FRONTEND_INDEX}")

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    import multiprocessing
    multiprocessing.freeze_support()
    uvicorn.run(app, host="127.0.0.1", port=8000)
