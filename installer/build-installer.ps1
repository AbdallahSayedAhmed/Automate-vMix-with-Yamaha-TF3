# ============================================================
# vMix-Yamaha TF3 Bridge — Build Installer Automation
# ============================================================
# This script downloads dependencies, compiles the launcher,
# and builds the final installer using Inno Setup.
#
# Prerequisites:
#   1. Inno Setup 6 installed
#      (https://jrsoftware.org/isdl.php)
#   2. ps2exe PowerShell module installed
#      (Run: Install-Module ps2exe -Scope CurrentUser)
# ============================================================

$ErrorActionPreference = "Stop"

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$depsDir = Join-Path $baseDir "deps"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  vMix-Yamaha TF3 Bridge — Build Installer  " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Base Dir: $baseDir"

# ─────────────────────────────────────────────────────────────
# 1. PREPARE DEPENDENCIES DIRECTORY
# ─────────────────────────────────────────────────────────────
if (-not (Test-Path $depsDir)) {
    New-Item -ItemType Directory -Path $depsDir | Out-Null
    Write-Host "Created deps directory: $depsDir"
}

# ─────────────────────────────────────────────────────────────
# 2. DOWNLOAD NODE.JS MSI (LTS x64)
# ─────────────────────────────────────────────────────────────
$nodeUrl = "https://nodejs.org/dist/v20.12.2/node-v20.12.2-x64.msi" # Using v20 LTS
$nodeMsi = Join-Path $depsDir "node-setup.msi"

if (-not (Test-Path $nodeMsi)) {
    Write-Host "`nDownloading Node.js installer..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi
    Write-Host "Downloaded: node-setup.msi" -ForegroundColor Green
} else {
    Write-Host "`nNode.js installer already downloaded." -ForegroundColor Green
}

# ─────────────────────────────────────────────────────────────
# 3. DOWNLOAD PYTHON INSTALLER (3.12 amd64)
# ─────────────────────────────────────────────────────────────
$pythonUrl = "https://www.python.org/ftp/python/3.12.3/python-3.12.3-amd64.exe"
$pythonExe = Join-Path $depsDir "python-setup.exe"

if (-not (Test-Path $pythonExe)) {
    Write-Host "`nDownloading Python installer..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonExe
    Write-Host "Downloaded: python-setup.exe" -ForegroundColor Green
} else {
    Write-Host "`nPython installer already downloaded." -ForegroundColor Green
}

# ─────────────────────────────────────────────────────────────
# 4. COMPILE LAUNCHER.PS1 TO LAUNCHER.EXE
# ─────────────────────────────────────────────────────────────
Write-Host "`nCompiling launcher.ps1 to launcher.exe..." -ForegroundColor Yellow

$launcherPs1 = Join-Path $baseDir "launcher.ps1"
$launcherExe = Join-Path $baseDir "launcher.exe"

# Check if ps2exe is installed
if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Write-Host "ps2exe module not found. Installing..." -ForegroundColor Yellow
    Install-Module ps2exe -Scope CurrentUser -Force -AllowClobber
}

try {
    # Remove old exe if exists
    if (Test-Path $launcherExe) { Remove-Item $launcherExe -Force }
    
    Invoke-ps2exe -inputFile $launcherPs1 -outputFile $launcherExe `
                  -noConsole -title "vMix-Yamaha TF3 Bridge" `
                  -description "System Tray Launcher" -version "1.0.0" `
                  -company "vMix-Yamaha Bridge" -copyright "Open Source" `
                  -iconFile "..\frontend\public\program-image.ico" `
                  -ErrorAction Stop
                  
    Write-Host "Compiled successfully: launcher.exe" -ForegroundColor Green
} catch {
    Write-Host "Failed to compile launcher.ps1. Error: $_" -ForegroundColor Red
    Write-Host "Make sure you run this script as Administrator if installing ps2exe." -ForegroundColor Red
    exit 1
}

# ─────────────────────────────────────────────────────────────
# 5. COMPILE INNO SETUP SCRIPT
# ─────────────────────────────────────────────────────────────
Write-Host "`nCompiling Inno Setup Script (setup.iss)..." -ForegroundColor Yellow

$issFile = Join-Path $baseDir "setup.iss"
$innoCompiler = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"

if (-not (Test-Path $innoCompiler)) {
    $innoCompiler = "C:\Program Files\Inno Setup 6\ISCC.exe"
}

if (-not (Test-Path $innoCompiler)) {
    Write-Host "ERROR: Inno Setup compiler (ISCC.exe) not found." -ForegroundColor Red
    Write-Host "Please install Inno Setup 6 from https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
    exit 1
}

try {
    $process = Start-Process -FilePath $innoCompiler -ArgumentList "`"$issFile`"" -Wait -NoNewWindow -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "`n============================================" -ForegroundColor Green
        Write-Host "  SUCCESS! Installer built successfully.    " -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "You can find the setup executable in: "
        Write-Host (Join-Path $baseDir "Output") -ForegroundColor Cyan
    } else {
        Write-Host "`nInno Setup compilation failed with exit code: $($process.ExitCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "Failed to run Inno Setup Compiler. Error: $_" -ForegroundColor Red
    exit 1
}
