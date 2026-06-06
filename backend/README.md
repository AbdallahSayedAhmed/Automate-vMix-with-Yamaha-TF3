# 🎛️ vMix ↔ Yamaha TF3 Automation Bridge

An asynchronous, ultra-low-latency middleware and control dashboard bridging live video production events from vMix to remote control protocol (RCP) commands for Yamaha TF series mixers.

## Architecture Stack

*   **Backend:** Python 3.11+, FastAPI, `asyncio`, SQLAlchemy, `aiosqlite`, `websockets`
*   **Frontend:** React.js (Vite), Tailwind CSS (v4), Lucide Icons
*   **Database:** SQLite
*   **Communication:**
    *   **vMix:** TCP API (Port 8099) for live tally/activator events, HTTP API (Port 8088) for input hydration.
    *   **Yamaha TF3:** RCP TCP Socket (Port 49280) for real-time mixer control.
    *   **Dashboard:** WebSockets for instant state and event log bridging.

## Project Structure (Monorepo)

```
.
├── backend/                # FastAPI Middleware Server
│   ├── app/                # Application package
│   │   ├── api/            # REST and WebSocket endpoints
│   │   ├── core/           # Configuration and app lifecycle
│   │   ├── db/             # SQLite models and CRUD
│   │   ├── drivers/        # vMix and Yamaha network clients
│   │   ├── engine/         # Trigger processing logic
│   │   └── schemas/        # Pydantic validation models
│   ├── main.py             # App entrypoint
│   └── requirements.txt    # Python dependencies
├── frontend/               # React Control Dashboard
│   ├── src/
│   │   ├── components/     # Reusable UI elements
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Dashboard views
│   │   ├── services/       # API integration
│   │   ├── App.jsx         # Main application component
│   │   ├── index.css       # Tailwind configuration and custom CSS
│   │   └── main.jsx        # React DOM entry
│   ├── package.json        # Node dependencies
│   └── vite.config.js      # Vite configuration and backend proxy
└── project_plan.md         # Detailed execution roadmap
```

## Setup Instructions

### 1. Backend (FastAPI)

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv .venv
    # Windows:
    .venv\Scripts\activate
    # macOS/Linux:
    source .venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run the development server:
    ```bash
    uvicorn app.main:app --reload
    ```
    The API will be available at `http://127.0.0.1:8000`.

### 2. Frontend (React/Vite)

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
    The dashboard will be available at `http://localhost:5173`.
