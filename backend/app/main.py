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
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine as db_engine, Base
from app.api import triggers, websocket, vmix_inputs, settings as settings_api
from app.drivers import vmix_tcp, yamaha_tcp
import asyncio

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
        }

    # Register API routers
    app.include_router(triggers.router, prefix="/api")
    app.include_router(vmix_inputs.router, prefix="/api")
    app.include_router(settings_api.router, prefix="/api")
    
    # Register WebSocket router
    app.include_router(websocket.router)

    return app


# Application instance used by uvicorn
app = create_app()
