# ============================================================
# vMix-Yamaha TF3 Bridge - System Tray Launcher
# ============================================================
# Compile to EXE with:
#   Invoke-ps2exe -inputFile launcher.ps1 -outputFile launcher.exe `
#       -noConsole -title "vMix-Yamaha TF3 Bridge" `
#       -description "Launcher for vMix-Yamaha TF3 Bridge" -version "1.0.0"
#
# Features:
#   - Starts the FastAPI backend silently
#   - Serves the bundled React dashboard from the backend
#   - Creates a system tray icon with context menu
#   - Opens the dashboard in the default browser
# ============================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$currentExe = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
if ($PSCommandPath -and ([System.IO.Path]::GetFileName($currentExe) -match '^(powershell|pwsh)(\.exe)?$')) {
    $script:installDir = Split-Path -Parent $PSCommandPath
} else {
    $script:installDir = Split-Path -Parent $currentExe
}

$script:logFile        = Join-Path $script:installDir "bridge.log"
$script:backendLogFile = Join-Path $script:installDir "backend.log"
$script:backendProcess = $null
$script:isRunning      = $false
$script:dashboardUrl   = "http://127.0.0.1:8000"
$script:healthUrl      = "http://127.0.0.1:8000/api/health"

function Write-BridgeLog {
    param([string]$Message)

    try {
        $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "$ts | $Message" | Out-File -FilePath $script:logFile -Append -Encoding utf8
    } catch { }
}

function Write-BackendLog {
    param([string]$Message)

    try {
        $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "$ts | $Message" | Out-File -FilePath $script:backendLogFile -Append -Encoding utf8
    } catch { }
}

function Open-Dashboard {
    Write-BridgeLog "Opening dashboard: $($script:dashboardUrl)"

    try {
        Start-Process -FilePath "explorer.exe" -ArgumentList $script:dashboardUrl -ErrorAction Stop
        Write-BridgeLog "Dashboard open command sent via explorer.exe."
        return $true
    } catch {
        Write-BridgeLog "WARNING: explorer.exe could not open dashboard: $_"
    }

    try {
        Start-Process -FilePath $script:dashboardUrl -ErrorAction Stop
        Write-BridgeLog "Dashboard open command sent via shell association."
        return $true
    } catch {
        Write-BridgeLog "WARNING: shell association could not open dashboard: $_"
    }

    try {
        Start-Process -FilePath "rundll32.exe" -ArgumentList "url.dll,FileProtocolHandler $($script:dashboardUrl)" -ErrorAction Stop
        Write-BridgeLog "Dashboard open command sent via url.dll."
        return $true
    } catch {
        Write-BridgeLog "ERROR: Could not open dashboard automatically: $_"
        [void][System.Windows.Forms.MessageBox]::Show(
            "The bridge is running, but Windows could not open the browser automatically.`n`nOpen this address manually:`n$($script:dashboardUrl)",
            "vMix-Yamaha Bridge",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
        return $false
    }
}

function Stop-ProcessTree {
    param([int]$ProcessId)

    try {
        $children = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
                    Where-Object { $_.ParentProcessId -eq $ProcessId }
        foreach ($child in $children) {
            Stop-ProcessTree -ProcessId $child.ProcessId
        }

        Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    } catch { }
}

function Normalize-BridgePath {
    param([string]$Path)

    if (-not $Path) {
        return ""
    }

    try {
        $fullPath = [System.IO.Path]::GetFullPath($Path)
    } catch {
        $fullPath = $Path
    }

    return $fullPath.TrimEnd([char[]]"\/").ToLowerInvariant()
}

function Get-ProcessSnapshot {
    try {
        return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
    } catch {
        return @()
    }
}

function Get-DescendantProcessIds {
    param(
        [int[]]$RootProcessIds,
        [object[]]$Processes
    )

    $ids = New-Object "System.Collections.Generic.HashSet[int]"
    foreach ($id in $RootProcessIds) {
        if ($id -gt 0) {
            [void]$ids.Add([int]$id)
        }
    }

    $changed = $true
    while ($changed) {
        $changed = $false
        foreach ($process in $Processes) {
            if ($process.ParentProcessId -and $ids.Contains([int]$process.ParentProcessId)) {
                if ($ids.Add([int]$process.ProcessId)) {
                    $changed = $true
                }
            }
        }
    }

    return @($ids)
}

function Get-CurrentInstallProcessIds {
    param([object[]]$Processes)

    $installRoot = Normalize-BridgePath $script:installDir
    $rootIds = @()

    foreach ($process in $Processes) {
        $commandLine = ""
        $executablePath = ""

        if ($process.CommandLine) {
            $commandLine = $process.CommandLine.ToLowerInvariant()
        }
        if ($process.ExecutablePath) {
            $executablePath = (Normalize-BridgePath $process.ExecutablePath)
        }

        if (($commandLine -and $commandLine.Contains($installRoot)) -or
            ($executablePath -and $executablePath.Contains($installRoot))) {
            $rootIds += [int]$process.ProcessId
        }
    }

    return Get-DescendantProcessIds -RootProcessIds $rootIds -Processes $Processes
}

function Get-BridgeBackendProcesses {
    param([object[]]$Processes)

    return @($Processes | Where-Object {
        $_.CommandLine -and
        $_.CommandLine -match "uvicorn" -and
        $_.CommandLine -match "app\.main:app" -and
        $_.CommandLine -match "--port\s+8000"
    })
}

function Get-PortOwnerProcessIds {
    try {
        return @(Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
                 Select-Object -ExpandProperty OwningProcess -Unique)
    } catch {
        return @()
    }
}

function Stop-StaleBridgeBackends {
    $processes = Get-ProcessSnapshot
    if (-not $processes -or $processes.Count -eq 0) {
        return
    }

    $staleProcesses = @()

    foreach ($process in (Get-BridgeBackendProcesses -Processes $processes)) {
        $staleProcesses += $process
    }

    foreach ($portOwnerProcessId in (Get-PortOwnerProcessIds)) {
        $owner = $processes | Where-Object { [int]$_.ProcessId -eq [int]$portOwnerProcessId } | Select-Object -First 1
        if ($owner -and $owner.CommandLine -and
            ($owner.CommandLine -match "app\.main:app" -or $owner.CommandLine -match "vMix-Yamaha Bridge")) {
            $staleProcesses += $owner
        }
    }

    $staleProcesses = @($staleProcesses | Sort-Object ProcessId -Unique)
    foreach ($process in $staleProcesses) {
        Write-BridgeLog "Stopping stale backend process PID $($process.ProcessId): $($process.CommandLine)"
        Stop-ProcessTree -ProcessId ([int]$process.ProcessId)
    }
}

function Test-StartedBackendOwnsPort {
    if (-not $script:backendProcess) {
        return $false
    }

    $processes = Get-ProcessSnapshot
    $startedIds = @(Get-DescendantProcessIds -RootProcessIds @([int]$script:backendProcess.Id) -Processes $processes)
    foreach ($portOwnerProcessId in (Get-PortOwnerProcessIds)) {
        if ($startedIds -contains [int]$portOwnerProcessId) {
            return $true
        }
    }

    return $false
}

function Test-HealthBelongsToThisInstall {
    param($Health)

    if (-not $Health -or $Health.status -ne "ok") {
        return $false
    }

    $propertyNames = @($Health.PSObject.Properties.Name)
    if ($propertyNames -contains "install_root" -and $Health.install_root) {
        $expectedRoot = Normalize-BridgePath $script:installDir
        $actualRoot = Normalize-BridgePath ([string]$Health.install_root)
        return $actualRoot -eq $expectedRoot
    }

    return Test-StartedBackendOwnsPort
}

function Resolve-PythonExe {
    param([string]$BackendDir)

    $candidates = @(
        (Join-Path $BackendDir ".venv\Scripts\python.exe"),
        (Join-Path $BackendDir ".venv\Scripts\pythonw.exe"),
        (Join-Path $BackendDir ".venv\bin\python.exe"),
        "python.exe",
        "pythonw.exe"
    )

    foreach ($candidate in $candidates) {
        if ([System.IO.Path]::IsPathRooted($candidate)) {
            if (Test-Path $candidate) {
                return $candidate
            }
        } else {
            $command = Get-Command $candidate -ErrorAction SilentlyContinue
            if ($command) {
                return $command.Source
            }
        }
    }

    return $null
}

function Wait-ForBackend {
    param([int]$TimeoutSeconds = 30)

    for ($attempt = 1; $attempt -le $TimeoutSeconds; $attempt++) {
        if ($script:backendProcess -and $script:backendProcess.HasExited) {
            Write-BridgeLog "ERROR: Backend exited during startup with code $($script:backendProcess.ExitCode)"
            return $false
        }

        try {
            $response = Invoke-RestMethod -Uri $script:healthUrl -TimeoutSec 2
            if (Test-HealthBelongsToThisInstall -Health $response) {
                return $true
            } elseif ($attempt -eq 1 -or ($attempt % 5) -eq 0) {
                $actualRoot = "<unknown>"
                if ($response -and (@($response.PSObject.Properties.Name) -contains "install_root")) {
                    $actualRoot = [string]$response.install_root
                }
                Write-BridgeLog "Waiting for this install's backend; health response came from: $actualRoot"
            }
        } catch { }

        Start-Sleep -Seconds 1
    }

    Write-BridgeLog "ERROR: Backend did not become ready at $($script:healthUrl)"
    return $false
}

function Start-Servers {
    if ($script:isRunning) {
        Write-BridgeLog "Bridge already running; opening browser."
        Open-Dashboard | Out-Null
        return $true
    }

    Write-BridgeLog "Starting bridge backend..."
    $backendDir = Join-Path $script:installDir "backend"
    if (-not (Test-Path $backendDir)) {
        Write-BridgeLog "ERROR: Backend folder not found: $backendDir"
        [void][System.Windows.Forms.MessageBox]::Show(
            "The backend folder was not found.`n`nExpected path:`n$backendDir",
            "vMix-Yamaha Bridge",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        return $false
    }

    try {
        Stop-StaleBridgeBackends
    } catch {
        Write-BridgeLog "WARNING: Could not stop stale bridge backends: $_"
    }

    $pythonExe = Resolve-PythonExe -BackendDir $backendDir
    if (-not $pythonExe) {
        Write-BridgeLog "ERROR: Python executable not found."
        [void][System.Windows.Forms.MessageBox]::Show(
            "Python was not found. Re-run the installer or install Python manually.",
            "vMix-Yamaha Bridge",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        return $false
    }

    try {
        "==== Backend start $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ====" |
            Out-File -FilePath $script:backendLogFile -Append -Encoding utf8
    } catch { }

    $backendCommand = '"' + $pythonExe + '" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 >> "' + $script:backendLogFile + '" 2>&1'

    $backendSI = New-Object System.Diagnostics.ProcessStartInfo
    $backendSI.FileName = $env:ComSpec
    $backendSI.Arguments = '/d /s /c "' + $backendCommand + '"'
    $backendSI.WorkingDirectory = $backendDir
    $backendSI.CreateNoWindow = $true
    $backendSI.UseShellExecute = $false
    $backendSI.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden

    try {
        $script:backendProcess = New-Object System.Diagnostics.Process
        $script:backendProcess.StartInfo = $backendSI

        [void]$script:backendProcess.Start()
        Write-BridgeLog "Backend process started (PID $($script:backendProcess.Id))"
        Write-BridgeLog "Backend output log: $($script:backendLogFile)"
    } catch {
        Write-BridgeLog "ERROR starting backend: $_"
        [void][System.Windows.Forms.MessageBox]::Show(
            "Failed to start the backend server.`n`n$_",
            "vMix-Yamaha Bridge",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        return $false
    }

    if (-not (Wait-ForBackend -TimeoutSeconds 30)) {
        [void][System.Windows.Forms.MessageBox]::Show(
            "The bridge backend did not become ready.`n`nOpen backend.log in the install folder for details.",
            "vMix-Yamaha Bridge",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        return $false
    }

    $script:isRunning = $true
    Open-Dashboard | Out-Null
    Write-BridgeLog "Dashboard open step completed."
    return $true
}

function Stop-Servers {
    Write-BridgeLog "Stopping bridge backend..."

    if ($script:backendProcess -and -not $script:backendProcess.HasExited) {
        Stop-ProcessTree -ProcessId $script:backendProcess.Id
        Write-BridgeLog "Backend stopped."
    }

    $script:isRunning = $false
    Write-BridgeLog "All services stopped."
}

$trayIcon = New-Object System.Windows.Forms.NotifyIcon

try {
    $trayIcon.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($currentExe)
} catch {
    $trayIcon.Icon = [System.Drawing.SystemIcons]::Application
}

$trayIcon.Text = "vMix-Yamaha TF3 Bridge"
$trayIcon.Visible = $true

$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

$titleItem = New-Object System.Windows.Forms.ToolStripMenuItem
$titleItem.Text = "vMix-Yamaha TF3 Bridge v1.0"
$titleItem.Enabled = $false
$titleItem.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$contextMenu.Items.Add($titleItem) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

$openItem = New-Object System.Windows.Forms.ToolStripMenuItem
$openItem.Text = "Open Dashboard"
$openItem.Add_Click({ Open-Dashboard | Out-Null })
$contextMenu.Items.Add($openItem) | Out-Null

$restartItem = New-Object System.Windows.Forms.ToolStripMenuItem
$restartItem.Text = "Restart Server"
$restartItem.Add_Click({
    $trayIcon.BalloonTipText = "Restarting server..."
    $trayIcon.ShowBalloonTip(2000)
    Stop-Servers
    Start-Sleep -Seconds 2
    if (Start-Servers) {
        $trayIcon.BalloonTipText = "Server restarted successfully."
    } else {
        $trayIcon.BalloonTipText = "Server restart failed. Open the log for details."
    }
    $trayIcon.ShowBalloonTip(3000)
})
$contextMenu.Items.Add($restartItem) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

$folderItem = New-Object System.Windows.Forms.ToolStripMenuItem
$folderItem.Text = "Open Install Folder"
$folderItem.Add_Click({ Start-Process "explorer.exe" -ArgumentList $script:installDir })
$contextMenu.Items.Add($folderItem) | Out-Null

$logItem = New-Object System.Windows.Forms.ToolStripMenuItem
$logItem.Text = "View Launcher Log"
$logItem.Add_Click({
    if (Test-Path $script:logFile) {
        Start-Process "notepad.exe" -ArgumentList $script:logFile
    } else {
        [void][System.Windows.Forms.MessageBox]::Show("Log file not found.", "vMix-Yamaha Bridge")
    }
})
$contextMenu.Items.Add($logItem) | Out-Null

$backendLogItem = New-Object System.Windows.Forms.ToolStripMenuItem
$backendLogItem.Text = "View Backend Log"
$backendLogItem.Add_Click({
    if (Test-Path $script:backendLogFile) {
        Start-Process "notepad.exe" -ArgumentList $script:backendLogFile
    } else {
        [void][System.Windows.Forms.MessageBox]::Show("Backend log file not found.", "vMix-Yamaha Bridge")
    }
})
$contextMenu.Items.Add($backendLogItem) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

$exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
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
$trayIcon.Add_DoubleClick({ Open-Dashboard | Out-Null })

Write-BridgeLog "========================================"
Write-BridgeLog "Launcher started"
Write-BridgeLog "Install dir: $($script:installDir)"
Write-BridgeLog "Dashboard URL: $($script:dashboardUrl)"
Write-BridgeLog "========================================"

$trayIcon.BalloonTipTitle = "vMix-Yamaha TF3 Bridge"
$trayIcon.BalloonTipText = "Starting server... please wait."
$trayIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$trayIcon.ShowBalloonTip(3000)

$appContext = New-Object System.Windows.Forms.ApplicationContext
try {
    $started = Start-Servers
    if ($started) {
        $trayIcon.BalloonTipText = "Bridge is running! Right-click the tray icon for options."
    } else {
        $trayIcon.BalloonTipText = "Bridge startup failed. Right-click the tray icon and open the log."
    }
    $trayIcon.ShowBalloonTip(5000)

    [System.Windows.Forms.Application]::Run($appContext)
} catch {
    Write-BridgeLog "FATAL launcher error: $_"
    [void][System.Windows.Forms.MessageBox]::Show(
        "The launcher hit an unexpected error.`n`n$_`n`nOpen bridge.log in the install folder for details.",
        "vMix-Yamaha Bridge",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    )
} finally {
    Stop-Servers
    $trayIcon.Visible = $false
    $trayIcon.Dispose()
    Write-BridgeLog "Launcher exited."
}
