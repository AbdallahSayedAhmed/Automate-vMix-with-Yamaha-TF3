# 🎛️ Automate vMix with Yamaha TF3

> **v1.0.0** — Real-time automation bridge between [vMix](https://www.vmix.com/) video production software and the [Yamaha TF3](https://uk.yamaha.com/en/products/proaudio/mixers/tf/index.html) digital audio mixer.

This software lets you create automation **rules** that link live video events (camera cuts, overlay activations, video playback) to audio console commands (mute a mic, change a fader level, recall a scene) — all happening automatically, in real-time, with zero manual intervention.

© 2026 — Abdallah Mahmoud

---

## Table of Contents

1. [What This Program Does](#what-this-program-does)
2. [Key Features](#key-features)
3. [System Requirements](#system-requirements)
4. [Installation](#installation)
5. [Network & Hardware Setup](#network--hardware-setup)
6. [Launching the Application](#launching-the-application)
7. [Dashboard Overview](#dashboard-overview)
8. [Creating Your First Rule (Step-by-Step)](#creating-your-first-rule-step-by-step)
9. [Rule Fields Explained](#rule-fields-explained)
10. [vMix Trigger Events Reference](#vmix-trigger-events-reference)
11. [Yamaha Command Reference](#yamaha-command-reference)
12. [vMix Action Functions Reference](#vmix-action-functions-reference)
13. [Auto-Ducking (Audio-Driven Automation)](#auto-ducking-audio-driven-automation)
14. [Multi-Mic Ducking (Group Duck)](#multi-mic-ducking-group-duck)
15. [Settings Configuration](#settings-configuration)
16. [Simulation & Testing Without Hardware](#simulation--testing-without-hardware)
17. [Updating the Software](#updating-the-software)
18. [Project Structure](#project-structure)
19. [Building the Installer](#building-the-installer)
20. [Troubleshooting](#troubleshooting)
21. [Image Placement Guide (for documentation contributors)](#image-placement-guide)

---

## What This Program Does

In live broadcast production, the **video operator** (running vMix) and the **audio engineer** (operating the Yamaha TF3) must constantly coordinate. When Camera 1 goes live, Microphone 1 must be unmuted. When a video plays, the background music must duck. When an overlay appears, a jingle starts.

This software **automates that coordination entirely**. You define rules once, and the bridge executes them in real-time over the local network with sub-millisecond latency.

<!-- 📸 IMAGE SUGGESTION: A diagram showing vMix PC ←→ This Bridge ←→ Yamaha TF3, with labeled arrows showing "TCP Events" and "RCP Commands" -->

---

## Key Features

| Feature | Description |
|---|---|
| **Bidirectional Sync** | vMix video events trigger Yamaha audio commands, AND Yamaha meter levels can trigger vMix actions |
| **Auto-Ducking** | Automatically lowers music when a microphone detects speech, restores when speech stops |
| **Multi-Mic Group Ducking** | Multiple microphones can independently control different audio targets with shared or separate thresholds |
| **Scene Recall** | Automatically load saved mixer scenes/snapshots when a video transition occurs |
| **Multi-Action Rules** | A single trigger can fire multiple actions simultaneously (mute + fade + scene recall) |
| **Smooth Fades** | Gradually change fader levels over a custom duration (e.g., fade music down over 2 seconds) |
| **Real-Time Dashboard** | Web-based control panel with live connection status, event logs, and rule management |
| **Drag & Drop Reordering** | Organize rules visually with drag handles |
| **Rule Grouping** | Color-code and group related rules together |
| **Import/Export** | Save your rule configuration to JSON and load it on another machine |
| **Auto-Reconnect** | If the network drops, the bridge automatically reconnects with exponential backoff |
| **Simulation Mode** | Test your rules without real hardware using the built-in mock servers |

---

## System Requirements

| Component | Requirement |
|---|---|
| Operating System | Windows 10 or later |
| Node.js | v18 or higher ([download](https://nodejs.org/)) |
| Python | v3.11 or higher ([download](https://www.python.org/downloads/)) |
| vMix | Any edition, running on the same or local network machine |
| Yamaha TF3 | Connected to the same LAN, reachable via TCP on port `49280` |
| Browser | Chrome, Edge, or Firefox (for the dashboard UI) |

---

## Installation

### Option 1 — Windows Installer (Recommended)

1. Download `vMix-Yamaha-Bridge-Setup.exe` from the Releases page.
2. Double-click and follow the installation wizard.
3. A Desktop shortcut is created — double-click to launch the standalone Desktop Application.

> **Note:** The installer is completely standalone. It does not require Python or Node.js to be installed on your computer.

### Updating the Program
To update your program in the future after making changes to the code, the process is very straightforward. Your user data (like the `.env` IP settings and the SQLite database) will **not** be overwritten during an update.

Here are the exact steps to follow when you want to release an update:

#### 1. Update the Version Number
Open the `installer\setup.iss` file and look near the top for this line:
```pascal
#define MyAppVersion   "1.0.0"
```
Change it to your new version number (for example, `"1.0.1"` or `"1.1.0"`).

#### 2. Build the New Installer
Open PowerShell as Administrator, navigate to the `installer/` folder, and run the build script:
```powershell
.\build-installer.ps1
```
OR
```powershell
powershell -ExecutionPolicy Bypass -File .\build-installer.ps1
```

This will compile your updated code into a standalone backend executable, package the frontend as an Electron app, and build a new `vMix-Yamaha-Bridge-Setup.exe` inside the `Output/` folder.

#### 3. Install the Update on the Target Machine
Take that new `.exe` to your production machine. Before running it, **you must stop the currently running program**:
1. Close the vMix-Yamaha Bridge desktop window.
2. Run your new `vMix-Yamaha-Bridge-Setup.exe`.

#### What happens during the update?
- The installer detects that the software is already installed.
- It will overwrite the old program files with your new compiled application.
- It **will not** overwrite your `.env` file or your `bridge.db` database. Your saved IPs and settings will remain completely intact!

### Option 2 — Manual / Developer Setup

```bash
# Clone or download the repository
git clone https://github.com/YOUR_USERNAME/automate-vmix-yamaha-tf3.git
cd automate-vmix-yamaha-tf3
```

**Backend setup:**
```bash
cd backend
python -m venv .venv

# Windows:
.venv\Scripts\activate

# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```
The API will be available at `http://127.0.0.1:8000`.

**Frontend setup:**
```bash
cd frontend
npm install
npm run dev
```
The dashboard will be available at `http://localhost:5173`. Or to run the Electron app in dev mode, `npm start`.

---

## Network & Hardware Setup

All three devices (the PC running this bridge, the PC running vMix, and the Yamaha TF3) must be on the **same local network** (plugged into the same switch/router).

### Step 1: Note the IP Addresses
Find the IPv4 address of each device:
- **vMix PC** — e.g., `192.168.1.100`
- **Yamaha TF3** — e.g., `192.168.1.50`
- **Bridge PC** — can be the same machine as vMix, in which case use `127.0.0.1`

### Step 2: Enable vMix Web Controller
1. Open vMix → **Settings** (top right).
2. Click **Web Controller** tab.
3. Check **Enable Web Controller**.
4. Note the port (usually `8088`).
5. Click **OK**. The TCP API on port `8099` is automatically enabled.

<!-- 📸 IMAGE SUGGESTION: Screenshot of vMix Settings → Web Controller tab with the checkbox highlighted -->

### Step 3: Verify Yamaha TF3 Network
1. On the TF3 touchscreen, tap the **Gear icon (Setup)**.
2. Select **Network**.
3. Ensure the mixer has a static IP on your network (e.g., `192.168.1.50`).
4. The TF3 listens for RCP commands on port **49280** by default — no extra configuration is needed.

<!-- 📸 IMAGE SUGGESTION: Photo of the Yamaha TF3 touchscreen Network settings page -->

### Step 4: Configure the Bridge

**Method A — Configuration File (recommended for production):**
1. Navigate to the `backend/` folder.
2. Create a file named `.env` with these contents:
```env
VMIX_HOST=192.168.1.100       # Use 127.0.0.1 if vMix is on the same PC
VMIX_TCP_PORT=8099
VMIX_HTTP_PORT=8088

YAMAHA_HOST=192.168.1.50      # Your mixer's IP address
YAMAHA_PORT=49280
```
3. Restart the backend server.

**Method B — Live Dashboard:**
1. Open the dashboard in your browser.
2. Click the **⚙ Config** button (top right corner).
3. Enter the vMix IP and Yamaha TF3 IP.
4. Click **Save Settings**.
5. Restart the backend terminal for socket connections to rebind.

### Step 5: Verify Connections
On the dashboard, the connection indicators for **vMix Engine** and **Yamaha TF3** should show **green / ONLINE**. If they show red, check the event log for error details.

<!-- 📸 IMAGE SUGGESTION: Screenshot of the dashboard showing both connection indicators in GREEN/ONLINE state -->
<!-- 📸 IMAGE SUGGESTION: Screenshot of the dashboard showing a connection indicator in RED/OFFLINE state with an error in the log -->

---

## Launching the Application

If you used the installer:
1. Double-click the **vMix-Yamaha Bridge** desktop shortcut.
2. The standalone Desktop Application window will open immediately.

If you set up manually:
1. Open a terminal in `backend/`, activate the virtual environment, and run `uvicorn app.main:app`.
2. Open a second terminal in `frontend/` and run `npm run dev`.
3. Open `http://localhost:5173` in your browser.

---

## Dashboard Overview

The dashboard is divided into two main areas:

### Panel A — Rule Configuration Table (Left Side)
This is where you create, edit, and manage your automation rules. It looks like a spreadsheet with:
- **Rule Name** — A descriptive name for each rule
- **Listen** — What event triggers this rule (e.g., "Camera 1 goes live")
- **Command** — What action to execute (e.g., "Unmute Yamaha Channel 1")
- **Status indicators** — Shows when a rule is firing in real-time

<!-- 📸 IMAGE SUGGESTION: Annotated screenshot of Panel A with arrows pointing to: the rule name column, the listen column, the command column, and the active/inactive toggle -->

### Panel B — Live Status & Event Log (Right Side)
- **Connection Indicators** — Large pulsing circles showing vMix and Yamaha connection status
- **Event Log** — A terminal-style scrolling log showing every event and action in real-time
- **Meter Display** — Shows live audio levels from the Yamaha when using ducking rules

<!-- 📸 IMAGE SUGGESTION: Annotated screenshot of Panel B showing the connection indicators, meter bars, and scrolling event log -->

### Top Toolbar
- **➕ Add Rule** — Creates a new automation rule
- **🔍 Search** — Filter rules by name or content
- **📥 Import / 📤 Export** — Load or save your rules as a JSON file
- **⚙ Config** — Open the IP/port settings modal

<!-- 📸 IMAGE SUGGESTION: Screenshot of the top toolbar with each button labeled -->

---

## Creating Your First Rule (Step-by-Step)

**Scenario:** When Camera 1 goes live in vMix, automatically unmute Microphone 1 on the Yamaha TF3.

1. Click the **➕ Add Rule** button in the top toolbar.
2. A new row appears in the rule table. Click on it to open the **Rule Editor** drawer.
3. Fill in the fields:
   - **Name:** `Camera 1 → Unmute Mic 1`
   - **Listen Source:** `vMix`
   - **Trigger Event:** `TransitionIn — Goes LIVE`
   - **vMix Input:** Select `Camera 1` from the dropdown (populated live from vMix)
   - **Action Target:** `Yamaha`
   - **Yamaha Command:** `Input Channel — Mute On/Off`
   - **Channel:** `1`
   - **Value:** `1` (1 = unmute, 0 = mute)
   - **Delay:** `0` ms (instant)
4. The rule is **active by default** (green toggle). Toggle it off if you want to prepare it without it running.
5. **Done!** The next time Camera 1 goes to Program in vMix, Mic 1 will automatically unmute on the TF3.

<!-- 📸 IMAGE SUGGESTION: Screenshot of the Rule Editor drawer filled in with the example above -->

---

## Rule Fields Explained

Every rule has these fields:

| Field | Description |
|---|---|
| **Name** | A descriptive label for the rule. For your own reference only. |
| **Listen Source** | Where to listen for events: `vMix` or `Yamaha`. |
| **Trigger Event** | The specific event that fires this rule (see reference below). |
| **vMix Input** | Which vMix input to watch (Camera 1, Video Clip, etc.). Populated live from vMix. |
| **Action Target** | Where to send the command: `Yamaha` or `vMix`. |
| **Yamaha Command** | The specific mixer function to control (see reference below). |
| **Channel (Ch)** | The Yamaha channel number the command applies to. |
| **Mix** | The Aux/Mix bus number (used with send commands). Default: `0`. |
| **Value** | The parameter to send (fader level, on/off state, scene number). |
| **Delay (ms)** | Wait time in milliseconds before executing the command. |
| **Active Toggle** | Enable or disable the rule without deleting it. |

---

## vMix Trigger Events Reference

These are the events your rules can listen for from vMix:

| Event | When It Fires | Typical Use |
|---|---|---|
| **TransitionIn** | An input goes LIVE (Program output) | Unmute a mic when a camera cuts on-air |
| **TransitionOut** | An input leaves LIVE | Mute a mic when a camera cuts off-air |
| **InputPreview** | An input is placed in PREVIEW (next-up) | Pre-load audio levels before the cut |
| **OverlayIn** | An overlay layer (lower-third, logo) activates | Duck music for an announcement graphic |
| **OverlayOut** | An overlay layer is deactivated | Restore music after the overlay disappears |
| **AudioOn** | An input's audio is un-muted in vMix | Sync audio states between vMix and Yamaha |
| **AudioOff** | An input's audio is muted in vMix | Mirror mute state to the mixer |
| **VideoPlay** | A video clip starts playing | Auto-duck music while the video rolls |
| **VideoPause** | A video clip pauses or finishes | Restore music after the video ends |
| **TimeRemaining** | A video reaches a specific time remaining | Trigger a warning or fade 1 minute before end |

---

## Yamaha Command Reference

These are all the Yamaha TF3 commands you can send:

### 🎤 Input Channels (Channels 1–40)

| Command | Label | Ch Range | Value | Description |
|---|---|---|---|---|
| `InCh/Fader/Level` | Input Channel — Fader Level | 1–40 | Integer (`0` = Unity/0dB, `-32768` = silence) | Moves the channel volume fader |
| `InCh/Fader/On` | Input Channel — Mute On/Off | 1–40 | `1` = active (unmuted), `0` = muted | Mutes or unmutes a channel |
| `InCh/Fader/Smooth` | Input Channel — Smooth Fade | 1–40 | `level,duration_ms` (e.g., `-2000,2000`) | Smoothly fades to a target level over time |

### 🔊 Master Stereo Output

| Command | Label | Ch | Value | Description |
|---|---|---|---|---|
| `St/Fader/Level` | Stereo Master — Level | 1 | Integer level | Main L/R Master Fader |
| `St/Fader/On` | Stereo Master — Mute On/Off | 1 | `1` or `0` | Mutes/unmutes the main output |

### 🎧 Aux/Mix Buses (Stage Monitors, Livestream Sends)

| Command | Label | Mix Range | Value | Description |
|---|---|---|---|---|
| `Mix/Fader/Level` | Aux/Mix Bus — Master Level | 1–20 | Integer level | Master volume for an Aux bus |
| `Mix/Fader/On` | Aux/Mix Bus — Mute On/Off | 1–20 | `1` or `0` | Mute/unmute an Aux bus |
| `InCh/ToMix/Level` | Channel → Aux Send Level | Ch + Mix | Integer level | Volume of one input going into an Aux bus |
| `InCh/ToMix/On` | Channel → Aux Send On/Off | Ch + Mix | `1` or `0` | Enable/disable a channel's send to an Aux |

### 🎛️ DCA Groups (1–8)

| Command | Label | Ch Range | Value | Description |
|---|---|---|---|---|
| `DCA/Fader/Level` | DCA Group — Level | 1–8 | Integer level | Volume for a DCA group (controls all assigned channels) |
| `DCA/Fader/On` | DCA Group — Mute On/Off | 1–8 | `1` or `0` | Mute/unmute an entire DCA group at once |

### 📡 Matrix Outputs (1–4)

| Command | Label | Ch Range | Value | Description |
|---|---|---|---|---|
| `Matrix/Fader/Level` | Matrix Output — Level | 1–4 | Integer level | Level of a Matrix output (lobby, overflow room) |
| `Matrix/Fader/On` | Matrix Output — Mute On/Off | 1–4 | `1` or `0` | Mute/unmute a Matrix output |

### 🎵 FX Sends & Returns (1–2)

| Command | Label | Mix | Value | Description |
|---|---|---|---|---|
| `InCh/ToFX/Level` | Channel → FX Send Level | 1 or 2 | Integer level | Send level from a channel to an FX processor |
| `InCh/ToFX/On` | Channel → FX Send On/Off | 1 or 2 | `1` or `0` | Enable/disable a channel's FX send |
| `FXRTN/Fader/Level` | FX Return — Level | 1 or 2 | Integer level | FX Return fader level |
| `FXRTN/Fader/On` | FX Return — Mute On/Off | 1 or 2 | `1` or `0` | Mute/unmute an FX Return |

### 💾 Scene Recall

| Command | Label | Value | Description |
|---|---|---|---|
| `ssrecall_ex` | Scene Recall — Load Preset | Scene number (e.g., `5`) | Loads a saved scene from the mixer's memory. The Channel field is ignored. |

**Scene Recall Example:**
To automatically load Scene 5 when a specific video ends:
- **Trigger Event:** `VideoPause`
- **Yamaha Command:** `ssrecall_ex`
- **Channel:** `0` (ignored for scenes)
- **Value:** `5` (the scene number to load)

The backend automatically converts this into the raw command: `ssrecall_ex 5 0 0 0 0 0`

### Understanding Fader Level Values

| Value | Meaning |
|---|---|
| `0` | Unity gain (0 dB) — standard operating level |
| `-327` | Approximately -3.27 dB (slightly quieter) |
| `-1000` | Approximately -10 dB (noticeably quieter) |
| `-2000` | Approximately -20 dB (very quiet) |
| `-5000` | Approximately -50 dB (nearly silent) |
| `-32768` | Negative infinity — absolute silence |
| `1000` | Approximately +10 dB (louder than unity) |

> **Rule of thumb:** Every `-1000` units is roughly -10 dB. Unity (0 dB) is `0`.

---

## vMix Action Functions Reference

When the **Action Target** is set to `vMix`, these functions are available:

### 🔊 Volume Control

| Function | Description | Needs Input? | Needs Value? |
|---|---|---|---|
| `SetVolume` | Sets the volume of a specific vMix input | Yes | Yes (0–100) |
| `SetMasterVolume` | Sets the Master output volume | No | Yes (0–100) |
| `SetBusAVolume` – `SetBusGVolume` | Sets volume for Bus A through G | No | Yes (0–100) |

### 🖼️ Overlay Control

| Function | Description | Needs Input? |
|---|---|---|
| `OverlayInput1` – `OverlayInput4` | Toggles an input on overlay channel 1–4 | Yes |
| `OverlayInput1In` – `OverlayInput4In` | Turns an input ON in overlay channel 1–4 | Yes |
| `OverlayInput1Out` – `OverlayInput4Out` | Turns overlay channel 1–4 OFF | Yes |
| `OverlayInputAllOff` | Turns all overlay channels off | No |

### 🎬 Transition Control

| Function | Description | Needs Input? |
|---|---|---|
| `PreviewInput` | Sends an input to Preview | Yes |
| `Cut` | Cuts a selected input to Program | Yes |
| `Fade` | Fades a selected input to Program | Yes |

---

## Auto-Ducking (Audio-Driven Automation)

Auto-ducking is the flagship feature. It monitors the Yamaha's live audio meters and automatically lowers (ducks) other audio channels when speech is detected.

**How it works:**
1. Set **Listen Source** to `Yamaha` and **Trigger Event** to `YamahaMeter`.
2. Set the **vMix Input** field to the Yamaha channel number you want to monitor (e.g., `1` for Mic 1).
3. Configure **Threshold** — the level above which speech is detected (e.g., `-4000`).
4. Configure **Release Threshold** — the level below which speech is considered stopped (e.g., `-5000`). This creates a hysteresis zone to prevent rapid on/off cycling.
5. Configure **Silence Timeout** — how long (ms) the level must stay below the release threshold before restoring (e.g., `3000` = 3 seconds).
6. Set the **Action** — typically a smooth fade to duck background music.

**Example: Duck background music when the host speaks into Mic 1:**
- **Listen Source:** Yamaha
- **Trigger Event:** YamahaMeter
- **Monitor Channel:** 1 (Mic 1)
- **Threshold:** -4000 (speech detected)
- **Release Threshold:** -5000 (speech stopped)
- **Silence Timeout:** 3000 ms
- **Yamaha Command:** `InCh/Fader/Smooth`
- **Channel:** 15 (background music channel)
- **Value:** `-2500,700` (fade to -25dB over 700ms)

When the host stops speaking, the original fader value is automatically captured and restored.

<!-- 📸 IMAGE SUGGESTION: Annotated screenshot of a ducking rule being configured in the Rule Editor, with the threshold/release/timeout fields highlighted -->
<!-- 📸 IMAGE SUGGESTION: Screenshot of the dashboard meter display showing live levels with ducking active (green bar moving) -->

---

## Multi-Mic Ducking (Group Duck)

For complex setups with multiple microphones that need to independently control different targets:

1. Enable **Multi-Duck** mode on the rule.
2. Add **Duck Members** — each member represents a monitored microphone with its own:
   - Monitor Channel (which Yamaha input to watch)
   - Threshold and Release Threshold
   - One or more Actions (which channels to duck)
3. The system uses **per-target restore** — each target channel only restores when ALL contributing microphones have stopped speaking.

**Example: Two presenters, each ducks a different music channel:**
- Member 1: Monitor Ch 1 → Duck Ch 15 (Music Left)
- Member 2: Monitor Ch 2 → Duck Ch 16 (Music Right)

<!-- 📸 IMAGE SUGGESTION: Screenshot of the Multi-Duck member configuration UI showing two members with different channels -->

---

## Settings Configuration

### Environment Variables

Create a `.env` file in the `backend/` folder:

```env
# vMix Connection
VMIX_HOST=127.0.0.1          # IP of the vMix PC
VMIX_TCP_PORT=8099            # vMix TCP API port (default: 8099)
VMIX_HTTP_PORT=8088           # vMix HTTP/Web API port (default: 8088)

# Yamaha TF3 Connection
YAMAHA_HOST=192.168.1.128     # IP of the Yamaha mixer
YAMAHA_PORT=49280             # Yamaha RCP port (default: 49280)

# Optional
DEBUG=false                   # Enable debug logging
DATABASE_URL=sqlite+aiosqlite:///./bridge.db   # Database file path
```

### Reconnect Behavior

The bridge automatically reconnects if a connection drops:
- **Initial delay:** 1 second
- **Maximum delay:** 30 seconds
- **Backoff factor:** 2× (1s → 2s → 4s → 8s → 16s → 30s)

---

## Simulation & Testing Without Hardware

You can test the entire system without a physical Yamaha TF3 or vMix:

**Terminal 1 — Start the fake Yamaha mixer:**
```bash
cd backend
python mock_yamaha.py
```
This listens on `127.0.0.1:49280` and responds with `OK` to all RCP commands.

**Terminal 2 — Start the fake vMix server:**
```bash
cd backend
python simulate.py
```
This emits random `TALLY` and `ACTS` transition events every 5–15 seconds.

**Terminal 3 — Start the backend:**
```bash
cd backend
uvicorn app.main:app --reload
```

**Terminal 4 — Start the frontend:**
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` and watch the rules fire in real-time!

<!-- 📸 IMAGE SUGGESTION: Screenshot showing 4 terminal windows side-by-side running the simulation -->

---

## Updating the Software

### 1. Update the Version Number
Open `installer/setup.iss` and change:
```pascal
#define MyAppVersion   "1.0.0"
```
to your new version number (e.g., `"1.1.0"`).

### 2. Build the New Installer
```powershell
cd installer
.\build-installer.ps1
```

### 3. Install the Update
1. Stop the running program (right-click system tray icon → **Stop & Exit**).
2. Run the new `vMix-Yamaha-Bridge-Setup.exe`.

**What happens during an update:**
- ✅ Old program files are overwritten with your newly compiled executable.
- ✅ Your `.env` file is **NOT** overwritten — your IP settings are preserved.
- ✅ Your `bridge.db` database is **NOT** overwritten — your saved rules are preserved.

---

## Project Structure

```
.
├── README.md                   # This file
├── backend/                    # FastAPI Middleware Server
│   ├── app/                    # Application package
│   │   ├── api/                # REST and WebSocket endpoints
│   │   │   ├── triggers.py     #   CRUD endpoints for rules
│   │   │   ├── websocket.py    #   Real-time WebSocket broadcasting
│   │   │   ├── vmix_inputs.py  #   Proxy to vMix HTTP API
│   │   │   └── settings.py     #   IP/port configuration endpoints
│   │   ├── core/               # Configuration and app lifecycle
│   │   │   └── config.py       #   Environment variable settings
│   │   ├── db/                 # Database layer
│   │   │   ├── models.py       #   SQLAlchemy ORM models
│   │   │   ├── crud.py         #   Create/Read/Update/Delete operations
│   │   │   └── database.py     #   Async SQLAlchemy engine
│   │   ├── drivers/            # Network clients
│   │   │   ├── vmix_client.py  #   vMix TCP socket (port 8099)
│   │   │   ├── vmix_http.py    #   vMix HTTP API (port 8088)
│   │   │   └── yamaha_rcp_client.py  #   Yamaha TF3 RCP socket (49280)
│   │   ├── engine/             # Automation logic
│   │   │   ├── trigger_engine.py     #   Core rule matching & execution
│   │   │   └── group_duck_engine.py  #   Multi-mic ducking logic
│   │   └── schemas/            # Pydantic validation models
│   ├── simulate.py             # Mock vMix TCP server for testing
│   ├── mock_yamaha.py          # Mock Yamaha TCP server for testing
│   ├── requirements.txt        # Python dependencies
│   └── .env                    # Connection settings (create this)
├── frontend/                   # React Control Dashboard
│   ├── src/
│   │   ├── components/         # UI components (PanelA, PanelB, etc.)
│   │   ├── constants/          # Command/event reference data
│   │   ├── hooks/              # Custom React hooks (WebSocket, API)
│   │   ├── pages/              # Dashboard page layout
│   │   ├── services/           # Backend API integration
│   │   └── index.css           # Dark AV control room theme
│   ├── package.json            # Node dependencies
│   └── vite.config.js          # Vite config with backend proxy
├── installer/                  # Windows installer scripts
│   ├── setup.iss               # Inno Setup configuration
│   ├── build-installer.ps1     # Build script
│   ├── launcher.ps1            # Application launcher
│   └── post-install.ps1        # Post-installation setup
└── pdf/                        # Yamaha RCP protocol reference
```

---

## Building the Installer

From the project root, run as Administrator:
```powershell
cd installer
.\build-installer.ps1
```
This auto-downloads Inno Setup and compiles `vMix-Yamaha-Bridge-Setup.exe` in the `Output/` folder.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| **vMix shows OFFLINE** | Ensure vMix is running and the Web Controller is enabled in Settings. Check the IP address in `.env`. Verify Windows Firewall allows port 8099. |
| **Yamaha shows OFFLINE** | Verify the mixer's IP address in `.env`. Ping the mixer from the bridge PC. Ensure the mixer is powered on and connected to the same network switch. |
| **Rules don't fire** | Check that the rule's **Active** toggle is ON (green). Verify the vMix input number matches the actual input in vMix. Check the event log for errors. |
| **Ducking doesn't restore** | Increase the **Silence Timeout** value. The level must stay below the Release Threshold for the full timeout period before restoration occurs. |
| **Dashboard won't load** | Ensure both the backend (`uvicorn`) and frontend (`npm run dev`) are running. Check that port 5173 is not blocked. |
| **Scene recall does nothing** | Verify the scene number exists on the mixer. Put the scene number in the **Value** field, not the Channel field. |
| **Connection keeps dropping** | Check for unstable network hardware. The bridge will auto-reconnect with exponential backoff. Look at the event log for specific error messages. |

---

## Image Placement Guide

If you are creating visual documentation (PDF manual, website), place illustrative images at these locations in the guide:

| Location in Guide | What to Screenshot/Photograph |
|---|---|
| **What This Program Does** | Network diagram: vMix PC ↔ Bridge ↔ Yamaha TF3 |
| **Installation (Installer)** | The Windows installer wizard window |
| **Network Setup — vMix** | vMix Settings → Web Controller tab |
| **Network Setup — Yamaha** | Photo of TF3 touchscreen → Network settings |
| **Connection Verification** | Dashboard with both indicators GREEN |
| **Connection Error** | Dashboard with RED indicator + error log |
| **Dashboard Overview — Panel A** | Full annotated screenshot of the rule table |
| **Dashboard Overview — Panel B** | Full annotated screenshot of the status/log panel |
| **Dashboard Overview — Toolbar** | Top bar with each button labeled |
| **Creating First Rule** | Rule Editor drawer filled with the example |
| **Auto-Ducking** | Rule Editor with ducking fields highlighted |
| **Auto-Ducking Active** | Dashboard meters showing live levels during ducking |
| **Multi-Mic Ducking** | Multi-Duck member config showing 2+ members |
| **Simulation Mode** | 4 terminal windows running the simulation together |
| **Settings Modal** | The Config modal with IP/port fields |

---

**Built with ❤️ for live broadcast professionals.**
