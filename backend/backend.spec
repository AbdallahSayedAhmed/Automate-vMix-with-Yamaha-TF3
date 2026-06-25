# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for vMix-Yamaha TF3 Bridge backend.
# Explicit excludes silence warnings for optional DB drivers
# (psycopg2, MySQLdb, etc.) not used by this project (SQLite only).

block_cipher = None

a = Analysis(
    ['app/main.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=[
        # uvicorn internals missed by static analysis
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # SQLAlchemy async + aiosqlite (only what we actually use)
        'sqlalchemy.dialects.sqlite',
        'aiosqlite',
        # pydantic_settings for .env loading
        'pydantic_settings',
    ],
    excludes=[
        # Suppress warnings for optional DB drivers not used in this project
        'psycopg2',
        'MySQLdb',
        'pysqlite2',
        'cx_Oracle',
        'pymysql',
        'tzdata',
        # Not needed in a headless server binary
        'tkinter',
        'matplotlib',
        'PIL',
        'numpy',
        'pandas',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
