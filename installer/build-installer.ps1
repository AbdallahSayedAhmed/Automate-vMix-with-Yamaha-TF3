# ============================================================
# vMix-Yamaha TF3 Bridge - Build Installer Automation
# ============================================================
# This script builds the React frontend, compiles the backend
# into a PyInstaller executable, builds the Electron app, and
# packages the final installer using Inno Setup.
#
# Prerequisites on the build machine:
#   1. Node.js LTS
#   2. Python 3
#   3. Inno Setup 6
# ============================================================

$ErrorActionPreference = "Stop"

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Resolve-Path (Join-Path $baseDir "..")
$frontendDir = Join-Path $projectDir "frontend"
$backendDir = Join-Path $projectDir "backend"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  vMix-Yamaha TF3 Bridge - Build Installer  " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Project Dir: $projectDir"
Write-Host "Installer Dir: $baseDir"

# ── Step 1: Compile Backend ──────────────────────────────────
Write-Host "`n[1/4] Compiling Backend with PyInstaller..." -ForegroundColor Yellow
Push-Location $backendDir
try {
    Write-Host "Installing/updating backend dependencies..."
    & python -m pip install -q -r requirements.txt pyinstaller

    Write-Host "Running PyInstaller (using backend.spec)..."
    # Use the spec file — it contains the exact hidden imports and excludes
    # needed to suppress spurious DB-driver warnings (psycopg2, MySQLdb, etc.)
    & python -m PyInstaller --noconfirm --clean backend.spec

    if (-not (Test-Path "dist\backend.exe")) {
        throw "PyInstaller failed to create dist\backend.exe."
    }
    Write-Host "Backend compiled successfully." -ForegroundColor Green
} finally {
    Pop-Location
}

# ── Step 2: Build Frontend + Electron ───────────────────────
Write-Host "`n[2/4] Building Frontend and Electron App..." -ForegroundColor Yellow
$npm = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command "npm" -ErrorAction SilentlyContinue }
if (-not $npm) {
    throw "npm was not found. Install Node.js LTS on the build machine, then run this script again."
}

Push-Location $frontendDir
try {
    Write-Host "Running npm install to ensure all requirements are present..."
    # Always install dependencies to make sure everything is up to date
    $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
    $env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
    & $npm.Source install

    Write-Host "Building React frontend..."
    & $npm.Source run build

    Write-Host "Packaging Electron application..."
    & $npm.Source run electron:build

    if (-not (Test-Path "dist_electron\win-unpacked\vMix-Yamaha Bridge.exe")) {
        throw "Electron build failed: 'dist_electron\win-unpacked\vMix-Yamaha Bridge.exe' was not created."
    }
    Write-Host "Frontend and Electron app built successfully." -ForegroundColor Green
} finally {
    Pop-Location
}

# ── Step 3: Locate Inno Setup ────────────────────────────────
Write-Host "`n[3/4] Locating Inno Setup compiler..." -ForegroundColor Yellow
$innoCompiler = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $innoCompiler)) {
    $innoCompiler = "C:\Program Files\Inno Setup 6\ISCC.exe"
}
if (-not (Test-Path $innoCompiler)) {
    throw "Inno Setup compiler (ISCC.exe) not found. Install Inno Setup 6 and run this script again."
}
Write-Host "Found Inno Setup: $innoCompiler" -ForegroundColor Green

# ── Step 4: Compile Installer ────────────────────────────────
Write-Host "`n[4/4] Compiling setup.iss..." -ForegroundColor Yellow
$issFile = Join-Path $baseDir "setup.iss"
$process = Start-Process -FilePath $innoCompiler -ArgumentList "`"$issFile`"" -Wait -NoNewWindow -PassThru

if ($process.ExitCode -ne 0) {
    throw "Inno Setup compilation failed with exit code $($process.ExitCode)."
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  SUCCESS! Installer built successfully.    " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
$outputFile = Join-Path $baseDir "Output\vMix-Yamaha-Bridge-Setup.exe"
Write-Host "Output: $outputFile" -ForegroundColor Cyan

