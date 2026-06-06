/**
 * launcher.js
 * Starts the backend server + frontend (npm run dev) completely in the
 * background (no CMD window), waits until the frontend is ready, then
 * opens the dashboard in the default browser.
 *
 * Config — edit the lines below to match your project:
 */
const CONFIG = {
  // URL that will be opened in the browser
  dashboardUrl: 'http://localhost:5173',

  // URL to poll to know the frontend is ready (usually same as dashboardUrl)
  frontendReadyUrl: 'http://localhost:5173',

  // Command to start your BACKEND server (relative to install folder)
  // Examples: 'node .'  |  'node server.js'  |  'node src/index.js'
  serverCmd:  'node',
  serverArgs: ['.'],

  // Max seconds to wait for the frontend before opening browser anyway
  maxWaitSeconds: 60,

  // Log file locations (inside install folder)
  serverLog:   'logs/server.log',
  frontendLog: 'logs/frontend.log',
  launcherLog: 'logs/launcher.log',
};

// ─────────────────────────────────────────────────────────────
const { spawn }  = require('child_process');
const path       = require('path');
const fs         = require('fs');
const http       = require('http');
const https      = require('https');

const APP_DIR  = __dirname;
const PID_FILE = path.join(APP_DIR, '.launcher.pids');

// ── Logging ──────────────────────────────────────────────────
function ensureLogDir() {
  const logDir = path.join(APP_DIR, 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(path.join(APP_DIR, CONFIG.launcherLog), line);
  } catch (_) {}
}

// ── Kill any previously launched instances ───────────────────
function killOldInstances() {
  try {
    const pids = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
    for (const pid of pids) {
      try { process.kill(pid, 'SIGTERM'); } catch (_) {}
    }
    log(`Killed old PIDs: ${pids.join(', ')}`);
  } catch (_) {}
}

function savePids(pids) {
  fs.writeFileSync(PID_FILE, JSON.stringify(pids));
}

// ── Spawn a process with NO visible window, output to log ───
function spawnHidden(cmd, args, logFile, label) {
  const logStream = fs.createWriteStream(path.join(APP_DIR, logFile), { flags: 'a' });
  const ts = () => `[${new Date().toISOString()}]`;

  const proc = spawn(cmd, args, {
    cwd:         APP_DIR,
    detached:    false,
    stdio:       ['ignore', 'pipe', 'pipe'],
    windowsHide: true,        // <-- hides CMD window on Windows
    shell:       true,
  });

  proc.stdout.on('data', d => {
    logStream.write(`${ts()} ${d}`);
  });
  proc.stderr.on('data', d => {
    logStream.write(`${ts()} [STDERR] ${d}`);
  });
  proc.on('exit', (code) => {
    logStream.write(`${ts()} ${label} exited with code ${code}\n`);
    log(`${label} exited with code ${code}`);
  });
  proc.on('error', (err) => {
    logStream.write(`${ts()} ${label} error: ${err.message}\n`);
    log(`${label} error: ${err.message}`);
  });

  log(`Spawned ${label} (PID ${proc.pid}): ${cmd} ${args.join(' ')}`);
  return proc;
}

// ── Poll a URL until it responds or timeout ──────────────────
function checkUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    try {
      const req = lib.get(url, { timeout: 1500 }, (res) => {
        resolve(res.statusCode < 500);
      });
      req.on('error',   () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    } catch (_) {
      resolve(false);
    }
  });
}

async function waitForUrl(url, maxMs) {
  const deadline = Date.now() + maxMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    if (await checkUrl(url)) {
      log(`Frontend ready after ${attempt} attempts`);
      return true;
    }
    await new Promise(r => setTimeout(r, 800));
  }
  log(`Timeout waiting for ${url} after ${attempt} attempts`);
  return false;
}

// ── Open the default browser ─────────────────────────────────
function openBrowser(url) {
  log(`Opening browser: ${url}`);
  const proc = spawn('cmd', ['/c', 'start', '', url], {
    detached:    true,
    stdio:       'ignore',
    windowsHide: true,
    shell:       false,
  });
  proc.unref();
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  ensureLogDir();
  log('=== Launcher starting ===');

  killOldInstances();

  // 1. Start backend server (hidden)
  const serverProc = spawnHidden(
    CONFIG.serverCmd,
    CONFIG.serverArgs,
    CONFIG.serverLog,
    'Backend Server'
  );

  // 2. Start frontend dev server (hidden)
  const frontendProc = spawnHidden(
    'npm',
    ['run', 'dev'],
    CONFIG.frontendLog,
    'Frontend Dev Server'
  );

  // 3. Save PIDs so stop.vbs can kill them later
  savePids([serverProc.pid, frontendProc.pid]);

  // 4. Wait for frontend to respond
  log(`Waiting for frontend at ${CONFIG.frontendReadyUrl}...`);
  const ready = await waitForUrl(
    CONFIG.frontendReadyUrl,
    CONFIG.maxWaitSeconds * 1000
  );

  if (!ready) {
    log('Frontend did not respond in time — opening browser anyway');
  }

  // 5. Open dashboard in browser
  openBrowser(CONFIG.dashboardUrl);

  // 6. Keep this process alive so children stay alive
  //    (they are NOT detached, so they live as long as launcher.js lives)
  process.on('SIGTERM', () => {
    log('Launcher received SIGTERM — shutting down children');
    try { serverProc.kill(); }   catch (_) {}
    try { frontendProc.kill(); } catch (_) {}
    process.exit(0);
  });

  // Heartbeat — keeps the event loop alive
  setInterval(() => {}, 60000);
}

main().catch(err => {
  log(`Fatal error: ${err.stack || err.message}`);
});
