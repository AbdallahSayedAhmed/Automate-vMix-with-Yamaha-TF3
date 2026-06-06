# ============================================================
# vMix-Yamaha TF3 Bridge — System Tray Launcher
# ============================================================
# Compile to EXE with:
#   Invoke-ps2exe -inputFile launcher.ps1 -outputFile launcher.exe `
#       -noConsole -title "vMix-Yamaha TF3 Bridge" `
#       -description "Launcher for vMix-Yamaha TF3 Bridge" -version "1.0.0"
#
# Features:
#   - Starts backend (Python/uvicorn) and frontend (npm run dev) silently
#   - Creates a system tray icon with context menu
#   - Opens the dashboard in the default browser
#   - Right-click tray: Open Dashboard / Restart / Stop & Exit
# ============================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ── Globals ──────────────────────────────────────────────────
$script:installDir      = Split-Path -Parent ([System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName)
$script:logFile         = Join-Path $script:installDir "bridge.log"
$script:backendProcess  = $null
$script:frontendProcess = $null
$script:isRunning       = $false
$script:dashboardUrl    = "http://localhost:5173"

# ── Logging ──────────────────────────────────────────────────
function Write-BridgeLog {
    param([string]$Message)
    try {
        $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "$ts | $Message" | Out-File -FilePath $script:logFile -Append -Encoding utf8
    } catch { }
}

# ── Kill a process and all its children ──────────────────────
function Stop-ProcessTree {
    param([int]$ProcessId)
    try {
        # Kill children first (recursive)
        $children = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
                    Where-Object { $_.ParentProcessId -eq $ProcessId }
        foreach ($child in $children) {
            Stop-ProcessTree -ProcessId $child.ProcessId
        }
        # Then kill the parent
        Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    } catch { }
}

# ── Start both servers ───────────────────────────────────────
function Start-Servers {
    if ($script:isRunning) {
        Write-BridgeLog "Servers already running — opening browser."
        Start-Process $script:dashboardUrl
        return
    }

    Write-BridgeLog "Starting servers..."
    $backendDir  = Join-Path $script:installDir "backend"
    $frontendDir = Join-Path $script:installDir "frontend"

    # ── Backend (Python / uvicorn) ───────────────────────────
    $pythonExe = Join-Path $backendDir ".venv\Scripts\pythonw.exe"
    if (-not (Test-Path $pythonExe)) {
        $pythonExe = Join-Path $backendDir ".venv\bin\pythonw.exe"
    }
    if (-not (Test-Path $pythonExe)) {
        $pythonExe = Join-Path $backendDir ".venv\bin\python.exe"
    }
    if (-not (Test-Path $pythonExe)) {
        # Fallback: try system pythonw
        $pythonExe = "pythonw.exe"
    }

    $backendSI = New-Object System.Diagnostics.ProcessStartInfo
    $backendSI.FileName         = $pythonExe
    $backendSI.Arguments        = "-m uvicorn app.main:app --host 0.0.0.0 --port 8000"
    $backendSI.WorkingDirectory = $backendDir
    $backendSI.CreateNoWindow   = $true
    $backendSI.UseShellExecute  = $false
    $backendSI.WindowStyle      = [System.Diagnostics.ProcessWindowStyle]::Hidden

    try {
        $script:backendProcess = [System.Diagnostics.Process]::Start($backendSI)
        Write-BridgeLog "Backend started  (PID $($script:backendProcess.Id))"
    } catch {
        Write-BridgeLog "ERROR starting backend: $_"
        [System.Windows.Forms.MessageBox]::Show(
            "Failed to start the backend server.`n`n$_",
            "vMix-Yamaha Bridge",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        return
    }

    # ── Frontend (Vite dev server) ───────────────────────────
    $frontendSI = New-Object System.Diagnostics.ProcessStartInfo
    $frontendSI.FileName         = "cmd.exe"
    $frontendSI.Arguments        = "/c npm run dev"
    $frontendSI.WorkingDirectory = $frontendDir
    $frontendSI.CreateNoWindow   = $true
    $frontendSI.UseShellExecute  = $false
    $frontendSI.WindowStyle      = [System.Diagnostics.ProcessWindowStyle]::Hidden

    try {
        $script:frontendProcess = [System.Diagnostics.Process]::Start($frontendSI)
        Write-BridgeLog "Frontend started (PID $($script:frontendProcess.Id))"
    } catch {
        Write-BridgeLog "ERROR starting frontend: $_"
        [System.Windows.Forms.MessageBox]::Show(
            "Failed to start the frontend dev server.`n`n$_",
            "vMix-Yamaha Bridge",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        return
    }

    $script:isRunning = $true

    # Wait for servers to boot, then open the dashboard
    Start-Sleep -Seconds 5
    Start-Process $script:dashboardUrl
    Write-BridgeLog "Dashboard opened in browser."
}

# ── Stop both servers ────────────────────────────────────────
function Stop-Servers {
    Write-BridgeLog "Stopping servers..."

    if ($script:backendProcess -and -not $script:backendProcess.HasExited) {
        Stop-ProcessTree -ProcessId $script:backendProcess.Id
        Write-BridgeLog "Backend stopped."
    }

    if ($script:frontendProcess -and -not $script:frontendProcess.HasExited) {
        Stop-ProcessTree -ProcessId $script:frontendProcess.Id
        Write-BridgeLog "Frontend stopped."
    }

    $script:isRunning = $false
    Write-BridgeLog "All servers stopped."
}

# ═════════════════════════════════════════════════════════════
# SYSTEM TRAY ICON
# ═════════════════════════════════════════════════════════════

$trayIcon = New-Object System.Windows.Forms.NotifyIcon

# Use the EXE's own icon (or fall back to system default)
try {
    $exePath = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
    $trayIcon.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
} catch {
    $trayIcon.Icon = [System.Drawing.SystemIcons]::Application
}

$trayIcon.Text    = "vMix-Yamaha TF3 Bridge"
$trayIcon.Visible = $true

# ── Context menu ─────────────────────────────────────────────
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

# Title (disabled, informational)
$titleItem         = New-Object System.Windows.Forms.ToolStripMenuItem
$titleItem.Text    = "vMix-Yamaha TF3 Bridge v1.0"
$titleItem.Enabled = $false
$titleItem.Font    = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$contextMenu.Items.Add($titleItem) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# Open Dashboard
$openItem      = New-Object System.Windows.Forms.ToolStripMenuItem
$openItem.Text = "Open Dashboard"
$openItem.Add_Click({ Start-Process $script:dashboardUrl })
$contextMenu.Items.Add($openItem) | Out-Null

# Restart Servers
$restartItem      = New-Object System.Windows.Forms.ToolStripMenuItem
$restartItem.Text = "Restart Servers"
$restartItem.Add_Click({
    $trayIcon.BalloonTipText = "Restarting servers..."
    $trayIcon.ShowBalloonTip(2000)
    Stop-Servers
    Start-Sleep -Seconds 2
    Start-Servers
    $trayIcon.BalloonTipText = "Servers restarted successfully."
    $trayIcon.ShowBalloonTip(3000)
})
$contextMenu.Items.Add($restartItem) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# Open Install Folder
$folderItem      = New-Object System.Windows.Forms.ToolStripMenuItem
$folderItem.Text = "Open Install Folder"
$folderItem.Add_Click({ Start-Process "explorer.exe" -ArgumentList $script:installDir })
$contextMenu.Items.Add($folderItem) | Out-Null

# View Log
$logItem      = New-Object System.Windows.Forms.ToolStripMenuItem
$logItem.Text = "View Log File"
$logItem.Add_Click({
    if (Test-Path $script:logFile) {
        Start-Process "notepad.exe" -ArgumentList $script:logFile
    } else {
        [System.Windows.Forms.MessageBox]::Show("Log file not found.", "vMix-Yamaha Bridge")
    }
})
$contextMenu.Items.Add($logItem) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# Stop & Exit
$exitItem      = New-Object System.Windows.Forms.ToolStripMenuItem
$exitItem.Text = "Stop && Exit"
$exitItem.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$exitItem.Add_Click({
    Stop-Servers
    $trayIcon.Visible = $false
    $trayIcon.Dispose()
    [System.Windows.Forms.Application]::Exit()
})
$contextMenu.Items.Add($exitItem) | Out-Null

$trayIcon.ContextMenuStrip = $contextMenu

# Double-click tray icon → open dashboard
$trayIcon.Add_DoubleClick({ Start-Process $script:dashboardUrl })

# ═════════════════════════════════════════════════════════════
# MAIN — Start everything
# ═════════════════════════════════════════════════════════════

Write-BridgeLog "========================================"
Write-BridgeLog "  Launcher started"
Write-BridgeLog "  Install dir: $($script:installDir)"
Write-BridgeLog "========================================"

# Show startup notification
$trayIcon.BalloonTipTitle = "vMix-Yamaha TF3 Bridge"
$trayIcon.BalloonTipText  = "Starting servers... please wait."
$trayIcon.BalloonTipIcon  = [System.Windows.Forms.ToolTipIcon]::Info
$trayIcon.ShowBalloonTip(3000)

# Start servers
Start-Servers

# Notify user
$trayIcon.BalloonTipText = "Bridge is running! Right-click the tray icon for options."
$trayIcon.ShowBalloonTip(5000)

# Run the Windows message loop (keeps the tray icon alive)
$appContext = New-Object System.Windows.Forms.ApplicationContext
try {
    [System.Windows.Forms.Application]::Run($appContext)
} finally {
    # Cleanup on exit
    Stop-Servers
    $trayIcon.Visible = $false
    $trayIcon.Dispose()
    Write-BridgeLog "Launcher exited."
}
