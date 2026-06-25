from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings

from sqlalchemy import event
from sqlalchemy.pool import NullPool

# Create async engine for SQLite
# check_same_thread=False is needed for SQLite
# Use NullPool for SQLite async as it manages its own connections via aiosqlite
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    poolclass=NullPool,
    connect_args={"check_same_thread": False}
)

@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA cache_size=-64000")
    cursor.close()

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

# Base class for SQLAlchemy declarative models
Base = declarative_base()

# Dependency to get DB session in FastAPI routes
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
