# ============================================================
# vMix-Yamaha TF3 Bridge - Build Installer Automation
# ============================================================
# This script builds the React frontend, compiles the PowerShell
# tray launcher, downloads the Python installer if needed, and
# builds the final installer using Inno Setup.
#
# Prerequisites on the build machine:
#   1. Node.js LTS
#   2. Inno Setup 6
#   3. ps2exe PowerShell module
# ============================================================

$ErrorActionPreference = "Stop"

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Resolve-Path (Join-Path $baseDir "..")
$frontendDir = Join-Path $projectDir "frontend"
$depsDir = Join-Path $baseDir "deps"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  vMix-Yamaha TF3 Bridge - Build Installer  " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Project Dir: $projectDir"
Write-Host "Installer Dir: $baseDir"

if (-not (Test-Path $depsDir)) {
    New-Item -ItemType Directory -Path $depsDir | Out-Null
    Write-Host "Created deps directory: $depsDir"
}

Write-Host "`n[1/5] Downloading Python installer if needed..." -ForegroundColor Yellow
$pythonUrl = "https://www.python.org/ftp/python/3.12.3/python-3.12.3-amd64.exe"
$pythonExe = Join-Path $depsDir "python-setup.exe"

if (-not (Test-Path $pythonExe)) {
    Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonExe
    Write-Host "Downloaded: python-setup.exe" -ForegroundColor Green
} else {
    Write-Host "Python installer already exists." -ForegroundColor Green
}

Write-Host "`n[2/5] Building frontend production files..." -ForegroundColor Yellow
$npm = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $npm) {
    $npm = Get-Command "npm" -ErrorAction SilentlyContinue
}
if (-not $npm) {
    throw "npm was not found. Install Node.js LTS on the build machine, then run this script again."
}

Push-Location $frontendDir
try {
    if (Test-Path "package-lock.json") {
        & $npm.Source ci
    } else {
        & $npm.Source install
    }

    & $npm.Source run build
    if (-not (Test-Path "dist\index.html")) {
        throw "Frontend build did not create dist\index.html."
    }
    Write-Host "Frontend built successfully." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host "`n[3/5] Compiling launcher.ps1 to launcher.exe..." -ForegroundColor Yellow
$launcherPs1 = Join-Path $baseDir "launcher.ps1"
$launcherExe = Join-Path $baseDir "launcher.exe"
$iconFile = Join-Path $projectDir "frontend\public\program-image.ico"

if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Write-Host "ps2exe module not found. Installing..." -ForegroundColor Yellow
    Install-Module ps2exe -Scope CurrentUser -Force -AllowClobber
}

if (Test-Path $launcherExe) {
    Remove-Item $launcherExe -Force
}

Invoke-ps2exe -inputFile $launcherPs1 -outputFile $launcherExe `
              -noConsole -title "vMix-Yamaha TF3 Bridge" `
              -description "System Tray Launcher" -version "1.0.0" `
              -company "vMix-Yamaha Bridge" -copyright "Open Source" `
              -iconFile $iconFile `
              -ErrorAction Stop

Write-Host "Compiled successfully: launcher.exe" -ForegroundColor Green

Write-Host "`n[4/5] Locating Inno Setup compiler..." -ForegroundColor Yellow
$innoCompiler = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $innoCompiler)) {
    $innoCompiler = "C:\Program Files\Inno Setup 6\ISCC.exe"
}
if (-not (Test-Path $innoCompiler)) {
    throw "Inno Setup compiler (ISCC.exe) not found. Install Inno Setup 6 and run this script again."
}
Write-Host "Found Inno Setup: $innoCompiler" -ForegroundColor Green

Write-Host "`n[5/5] Compiling setup.iss..." -ForegroundColor Yellow
$issFile = Join-Path $baseDir "setup.iss"
$process = Start-Process -FilePath $innoCompiler -ArgumentList "`"$issFile`"" -Wait -NoNewWindow -PassThru

if ($process.ExitCode -ne 0) {
    throw "Inno Setup compilation failed with exit code $($process.ExitCode)."
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  SUCCESS! Installer built successfully.    " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "Output folder:" -ForegroundColor Cyan
Write-Host (Join-Path $baseDir "Output")
