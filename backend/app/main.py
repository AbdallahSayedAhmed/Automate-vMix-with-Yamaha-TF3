"""
FastAPI application factory with async lifespan management.

This is the main entry point for the backend server.  The lifespan
context manager handles startup/shutdown of:
  - SQLite database (table creation)
  - vMix TCP listener (background task)
  - Yamaha RCP client (background task)
  - Trigger engine loop (background task)
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.database import engine as db_engine, Base
from app.api import triggers, websocket, vmix_inputs, settings as settings_api
import asyncio

from app.drivers import vmix_tcp, yamaha_tcp


APP_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = APP_ROOT / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Async lifespan: runs once on startup, yields while app serves,
    then runs cleanup on shutdown.
    """
    # ── STARTUP ──────────────────────────────────────────────────
    print(f"[*] {settings.app_name} starting up...")
    print("   Initializing database tables...")
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Start network drivers in the background
    print(f"   Connecting to vMix TCP   -> {settings.vmix_host}:{settings.vmix_tcp_port}")
    asyncio.create_task(vmix_tcp.connect())
    
    print(f"   Connecting to Yamaha TF3 -> {settings.yamaha_host}:{settings.yamaha_port}")
    asyncio.create_task(yamaha_tcp.connect())
    
    # Start XML poller to track audio state without relying on ACTS
    from app.engine.trigger_engine import engine as trigger_engine
    trigger_engine.start_xml_poller(settings.vmix_host, settings.vmix_http_port)
    
    yield
    # ── SHUTDOWN ─────────────────────────────────────────────────
    print(f"🛑 {settings.app_name} shutting down...")
    await vmix_tcp.disconnect()
    await yamaha_tcp.disconnect()


def create_app() -> FastAPI:
    """Build and configure the FastAPI application instance."""
    app = FastAPI(
        title=settings.app_name,
        description=(
            "Asynchronous middleware bridging vMix video production events "
            "to Yamaha TF3 digital mixer commands in real-time."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Health Check ─────────────────────────────────────────────
    @app.get("/api/health", tags=["System"])
    async def health_check():
        """Basic health check endpoint."""
        return {
            "status": "ok",
            "service": settings.app_name,
            "version": "0.1.0",
            "install_root": str(APP_ROOT),
            "frontend_ready": FRONTEND_INDEX.is_file(),
        }

    # Register API routers
    app.include_router(triggers.router, prefix="/api")
    app.include_router(vmix_inputs.router, prefix="/api")
    app.include_router(settings_api.router, prefix="/api")
    
    # Register WebSocket router
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
            raise HTTPException(
                status_code=503,
                detail=f"Frontend production build is missing: {FRONTEND_INDEX}",
            )

        @app.get("/{path:path}", include_in_schema=False)
        async def frontend_asset_not_available(path: str):
            if path.startswith(("api/", "ws/")):
                raise HTTPException(status_code=404)

            raise HTTPException(
                status_code=503,
                detail=f"Frontend production build is missing: {FRONTEND_INDEX}",
            )

    return app


# Application instance used by uvicorn
app = create_app()
