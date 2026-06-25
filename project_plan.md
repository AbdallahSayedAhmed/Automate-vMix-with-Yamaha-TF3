# 🎛️ vMix ↔ Yamaha TF3 Automation Bridge — Project Plan

> **Status**: PHASE 6 IN PROGRESS  
> **Last Updated**: 2026-06-03  
> **Architecture**: FastAPI (Python) + React/Vite (Tailwind CSS) + SQLite + WebSockets

---

## PHASE 1: PROJECT BLUEPRINT & ENVIRONMENT SETUP

- [x] 1.1 Create monorepo root directory structure (`/backend`, `/frontend`)
- [x] 1.2 Create backend sub-directory structure:
  - `backend/app/` — FastAPI application package
  - `backend/app/api/` — REST/WebSocket route handlers
  - `backend/app/core/` — Config, settings, lifecycle management
  - `backend/app/db/` — SQLAlchemy models, session factory, CRUD
  - `backend/app/drivers/` — vMix TCP client, Yamaha RCP client
  - `backend/app/engine/` — Trigger matching/execution engine
  - `backend/app/schemas/` — Pydantic request/response schemas
- [x] 1.3 Create `backend/requirements.txt` with pinned production deps
- [x] 1.4 Create `backend/app/__init__.py` and all sub-package `__init__.py` files
- [x] 1.5 Create `backend/app/core/config.py` — Pydantic settings with env vars
- [x] 1.6 Scaffold `backend/app/main.py` — FastAPI app factory with lifespan
- [x] 1.7 Initialize frontend with Vite + React + Tailwind CSS
- [x] 1.8 Create comprehensive `README.md` with absolute setup guidelines
- [x] 1.9 Create `.gitignore` for Python/Node artifacts

---

## PHASE 2: DATABASE STORAGE LAYER & MODELS

- [x] 2.1 Create `backend/app/db/database.py` — Async SQLAlchemy engine + session factory
- [x] 2.2 Create `backend/app/db/models.py` — `TriggerRule` ORM model with fields:
  - `id` (PK), `name`, `trigger_event`, `vmix_input_number`, `vmix_input_name`
  - `yamaha_command`, `yamaha_channel`, `parameter_value`
  - `delay_ms`, `is_active`, `created_at`, `updated_at`
- [x] 2.3 Create `backend/app/schemas/trigger.py` — Pydantic schemas (Create, Update, Response)
- [x] 2.4 Create `backend/app/db/crud.py` — Async CRUD functions (create, list, get, update, delete, toggle)
- [x] 2.5 Create `backend/app/api/triggers.py` — FastAPI router with REST endpoints:
  - `POST /api/triggers` — Create new rule
  - `GET /api/triggers` — List all rules
  - `GET /api/triggers/{id}` — Get single rule
  - `PUT /api/triggers/{id}` — Update rule
  - `DELETE /api/triggers/{id}` — Delete rule
  - `PATCH /api/triggers/{id}/toggle` — Toggle active state
- [x] 2.6 Wire DB initialization into FastAPI lifespan (create tables on startup)
- [x] 2.7 Verify DB compiles — run `uvicorn` and test CRUD endpoints

---

## PHASE 3: ASYNCHRONOUS NETWORK DRIVERS (THE BACKBONE)

- [x] 3.1 Create `backend/app/drivers/vmix_client.py`:
  - Async TCP socket connection to vMix port 8099
  - `SUBSCRIBE TALLY` and `SUBSCRIBE ACTS` event streams
  - Stream parser splitting `\r\n`-delimited messages
  - Exponential backoff reconnect with configurable max retries
  - Connection state management (connected/disconnected/reconnecting)
  - Callback dispatch for parsed events
- [x] 3.2 Create `backend/app/drivers/vmix_http.py`:
  - `httpx.AsyncClient` for vMix Web API (port 8088)
  - `GET /api/` — Fetch full XML state, parse input list
  - Extract input `number`, `title`, `type`, `key` for frontend dropdowns
- [x] 3.3 Create `backend/app/drivers/yamaha_rcp_client.py`:
  - Async TCP socket connection to Yamaha TF3 port 49280
  - Command compiler: `set MIXER:Current/{path} {channel} 0 {value}\n`
  - Support all TF3 RCP command categories:
    - `InCh/Fader/Level`, `InCh/Fader/On` (mute)
    - `Mix/Fader/Level`, `Mix/Fader/On`
    - `DCA/Fader/Level`, `DCA/Fader/On`
    - `St/Fader/Level`, `St/Fader/On`
    - `InCh/ToMix/Level`, `InCh/ToMix/On`
    - Scene recall: `ssrecall_ex {scene} 0 0 0 0 0`
  - Response parser (`OK`, `OKm`, `NOTIFY`, `ERROR`)
  - Exponential backoff reconnect
  - Thread-safe write queue using `asyncio.Queue`
- [x] 3.4 Create `backend/app/drivers/__init__.py` exporting client singletons
- [x] 3.5 Write unit tests / mock test verifying vMix event → Yamaha command pipeline

---

## PHASE 4: FASTAPI CORE ROUTING & WEBSOCKET ENGINE

- [x] 4.1 Create `backend/app/engine/trigger_engine.py`:
  - Event ingestion: parse vMix TCP event → extract event type + input ID
  - Rule matching: query DB for active rules matching event + input
  - Delay execution: `asyncio.sleep(delay_ms / 1000)`
  - Command dispatch: compile Yamaha RCP string → send via driver
  - Log each execution to in-memory ring buffer
- [x] 4.2 Create `backend/app/api/websocket.py`:
  - `WebSocket /ws/status` endpoint
  - Broadcast connection statuses (vMix, Yamaha) on state change
  - Stream real-time event log entries
  - Client connection manager (add/remove/broadcast)
- [x] 4.3 Create `backend/app/api/vmix_inputs.py`:
  - `GET /api/vmix/inputs` — proxy to vMix HTTP API, return JSON input list
  - `GET /api/vmix/status` — return connection health
- [x] 4.4 Create `backend/app/api/settings.py`:
  - `GET /api/settings` — return current vMix/Yamaha connection config
  - `PUT /api/settings` — update connection targets (IP, port)
- [x] 4.5 Wire all routers into main app, integrate lifespan startup/shutdown:
  - Start vMix TCP listener as background task
  - Start Yamaha RCP connection as background task
  - Start trigger engine processing loop
- [x] 4.6 Verify API and WebSocket server run cleanly without blocking

---

## PHASE 5: REACT INTERACTIVE AV DASHBOARD

- [x] 5.1 Set up project structure:
  - `src/components/` — Reusable UI components
  - `src/hooks/` — Custom React hooks (useWebSocket, useTriggers)
  - `src/services/` — API client functions
  - `src/pages/` — Main dashboard page
- [x] 5.2 Create design system and global styles:
  - Ultra-dark AV control room theme (Tailwind config)
  - Custom color palette: deep blacks, neon accent greens/cyans
  - Inter/JetBrains Mono typography
- [x] 5.3 Build **Panel A — Configuration Panel**:
  - Spreadsheet-style trigger rule table
  - Inline editing with dropdowns for:
    - Trigger Event (TransitionIn, OverlayIn, etc.)
    - vMix Input (populated dynamically via API)
    - Yamaha Command (fader level, mute, DCA, etc.)
    - Yamaha Channel (1-32 for InCh, 1-8 for DCA, etc.)
    - Parameter Value (level 0-1023, on/off)
    - Delay (ms)
  - Add/Delete/Toggle active buttons per row
- [x] 5.4 Build **Panel B — Live Status & Event Log**:
  - Large connection status indicators (vMix ● / Yamaha ●)
  - Green/Red pulse animations for connected/disconnected
  - Terminal-style scrolling event log (monospace, timestamps)
  - WebSocket-driven real-time updates
- [x] 5.5 Build **Settings Modal**:
  - vMix IP/Port configuration
  - Yamaha TF3 IP/Port configuration
  - Save/Test connection buttons
- [x] 5.6 Implement responsive layout and micro-animations
- [x] 5.7 Wire all API calls and WebSocket connections

---

## PHASE 6: INTEGRATION, DRY-RUN SIMULATION, AND OPTIMIZATION

- [x] 6.1 Create `backend/simulate.py` — Dummy vMix TCP server:
  - Emits fake `TALLY` and `ACTS` events at configurable intervals
  - Simulates input transitions and overlay activations
- [x] 6.2 Create `backend/mock_yamaha.py` — Dummy Yamaha TCP listener:
  - Receives and logs RCP commands
  - Responds with `OK` or `NOTIFY`
- [x] 6.3 Full integration test:
  - Start simulation servers + middleware + frontend
  - Verify trigger rules fire correctly with proper delays
  - Verify WebSocket dashboard updates in real-time
- [x] 6.4 Performance optimization:
  - Benchmark event-to-command latency
  - Optimize DB query caching for hot rules
  - Connection pool tuning
- [x] 6.5 Error handling hardening:
  - Network drop recovery verification
  - Graceful shutdown testing
  - Edge case validation (empty DB, invalid commands)
- [x] 6.6 Final documentation and deployment guide update
