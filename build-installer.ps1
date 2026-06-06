# ============================================================
#  build-installer.ps1
#  Automatically installs NSIS (if missing) then compiles
#  installer.nsi into AutomateVmixYamahaTF3_Setup_v1.0.0.exe
#
#  Usage: Right-click -> "Run with PowerShell" (as Admin)
#         or: powershell -ExecutionPolicy Bypass -File build-installer.ps1
# ============================================================

$ProjectPath = 'W:\Programing\Projects\Automate vmix with yamaha tf3_1'
$NsisVersion = "3.10"
$NsisUrl     = "https://downloads.sourceforge.net/project/nsis/NSIS%203/$NsisVersion/nsis-$NsisVersion-setup.exe"
$NsisExe     = "C:\Program Files (x86)\NSIS\makensis.exe"

# ── Helpers ────────────────────────────────────────────────
function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "  [!!] $msg" -ForegroundColor Red ; exit 1 }
function Write-Warn { param($msg) Write-Host "  [!!] $msg" -ForegroundColor Yellow }

# ── Must run as admin ───────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warn "Re-launching as Administrator..."
    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# ── 1. Move to project ─────────────────────────────────────
Write-Step "Checking project folder..."
if (-not (Test-Path $ProjectPath)) { Write-Fail "Project path not found: $ProjectPath" }
Set-Location $ProjectPath
Write-OK "Working in: $ProjectPath"

# ── 2. Check that installer.nsi is present ─────────────────
Write-Step "Checking installer.nsi..."
if (-not (Test-Path "installer.nsi")) {
    Write-Fail "installer.nsi not found in: $ProjectPath$\nCopy installer.nsi into the project root first."
}
Write-OK "installer.nsi found"

# ── 3. Install NSIS if needed ──────────────────────────────
Write-Step "Checking NSIS..."
if (-not (Test-Path $NsisExe)) {
    Write-Warn "NSIS not found — downloading NSIS $NsisVersion..."
    $nsisInstaller = "$env:TEMP\nsis-setup.exe"
    try {
        Invoke-WebRequest -Uri $NsisUrl -OutFile $nsisInstaller -UseBasicParsing
    } catch {
        # Fallback: try winget
        Write-Warn "Direct download failed. Trying winget..."
        winget install --id NSIS.NSIS --silent --accept-package-agreements --accept-source-agreements
        if (-not (Test-Path $NsisExe)) {
            Write-Fail "Could not install NSIS automatically.$\nPlease install manually from https://nsis.sourceforge.io/Download"
        }
    }
    if (Test-Path $nsisInstaller) {
        Write-OK "Download complete. Installing NSIS silently..."
        Start-Process $nsisInstaller -ArgumentList "/S" -Wait
        Remove-Item $nsisInstaller -Force
    }
    if (-not (Test-Path $NsisExe)) {
        Write-Fail "NSIS installation failed. Please install manually from https://nsis.sourceforge.io/Download"
    }
}
Write-OK "NSIS found: $NsisExe"

# ── 4. Update APP_PUBLISHER in .nsi with real name ─────────
Write-Step "Personalizing installer.nsi..."
$nsiContent = Get-Content "installer.nsi" -Raw
if ($nsiContent -match 'APP_PUBLISHER\s+"Your Name / Studio"') {
    $publisher = Read-Host "  Enter your name/studio name for the installer (press Enter to keep default)"
    if (-not [string]::IsNullOrWhiteSpace($publisher)) {
        $nsiContent = $nsiContent -replace '"Your Name / Studio"', "`"$publisher`""
        Set-Content "installer.nsi" $nsiContent -Encoding UTF8
        Write-OK "Publisher set to: $publisher"
    } else {
        Write-OK "Keeping default publisher"
    }
}

# Also patch GitHub URL if needed
if ($nsiContent -match 'YOUR_USERNAME') {
    $ghUser = Read-Host "  Enter your GitHub username (press Enter to skip)"
    if (-not [string]::IsNullOrWhiteSpace($ghUser)) {
        $nsiContent = $nsiContent -replace 'YOUR_USERNAME', $ghUser
        Set-Content "installer.nsi" $nsiContent -Encoding UTF8
        Write-OK "GitHub URL updated"
    }
}

# ── 5. Compile installer ────────────────────────────────────
Write-Step "Compiling installer EXE..."
$outExe = Join-Path $ProjectPath "AutomateVmixYamahaTF3_Setup_v1.0.0.exe"
$process = Start-Process -FilePath $NsisExe `
    -ArgumentList "/V3", "`"$ProjectPath\installer.nsi`"" `
    -Wait -PassThru -NoNewWindow

if ($process.ExitCode -ne 0) {
    Write-Fail "makensis failed with exit code $($process.ExitCode).$\nCheck the output above for errors."
}
Write-OK "Compilation successful!"

# ── 6. Summary ─────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " Installer built successfully!" -ForegroundColor Green
Write-Host " Output: $outExe" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host " To test: double-click AutomateVmixYamahaTF3_Setup_v1.0.0.exe"
Write-Host " To distribute: upload to GitHub Releases or share directly."
Write-Host ""

# Open folder in Explorer
Start-Process explorer.exe -ArgumentList "/select,`"$outExe`""
