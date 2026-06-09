# 🎛️ Automate vMix with Yamaha TF3

> **v1.0.0** — Automation bridge between [vMix](https://www.vmix.com/) and the [Yamaha TF3](https://uk.yamaha.com/en/products/proaudio/mixers/tf/index.html) digital mixer.

Automates communication between vMix (video production software) and the Yamaha TF3 audio console — enabling scene changes, input routing, and show control to stay in sync automatically.

---

## ✨ Features

- 🔁 Bidirectional sync between vMix and Yamaha TF3
- 🎬 Trigger audio scenes on vMix transitions
- 🎚️ Automate channel mute/unmute based on active inputs
- 🛠️ Easy configuration via JSON

---

## 🚀 Quick Start

### Option 1 — Windows Installer (Recommended)

1. Download `AutomateVmixYamahaTF3_Setup_v1.0.0.exe` from [Releases](../../releases)
2. Double-click and follow the wizard
3. A Desktop shortcut is created — double-click to launch
4. A Desktop shortcut is created — double-click to launch

### Option 2 — Manual / Developer Setup

**Requirements:**

- [Node.js](https://nodejs.org/) v18 or higher
- [python](https://www.python.org/downloads/) v13 or higher
- [python](https://www.python.org/downloads/) v13 or higher
- [Git](https://git-scm.com/) (optional)
- vMix running on the same or local network machine
- Yamaha TF3 reachable via TCP (default port `49280`)

````bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/automate-vmix-yamaha-tf3.git
cd automate-vmix-yamaha-tf3

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

```
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

````

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and edit the values:

```env
# vMix
VMIX_HOST=127.0.0.1
VMIX_PORT=8099

# Yamaha TF3
TF3_HOST=192.168.1.100
TF3_PORT=49280
```

---

## 📁 Project Structure

```
.
├── index.js           # Main entry point
├── src/
│   ├── vmix.js        # vMix TCP/API connector
│   ├── yamaha.js      # Yamaha TF3 MIDI/TCP connector
│   └── bridge.js      # Automation logic
├── config/
│   └── scenes.json    # Scene mapping configuration
├── package.json
└── README.md
```

---

## 📦 Building the Installer

```powershell
# From the project root (run as Admin)
powershell -ExecutionPolicy Bypass -File build-installer.ps1
```

This auto-installs NSIS and compiles `AutomateVmixYamahaTF3_Setup_v1.0.0.exe`.

---

## 🤝 Contributing

Pull requests welcome! Please open an issue first to discuss major changes.

---

## 📄 License

© 2026 — Abdallah Mahmoud
