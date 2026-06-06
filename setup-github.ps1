# ============================================================
#  setup-github.ps1
#  Creates a GitHub repo and pushes the project as v1.0.0
#  Run with: powershell -ExecutionPolicy Bypass -File setup-github.ps1
# ============================================================

param(
    [string]$RepoName    = "automate-vmix-yamaha-tf3",
    [string]$Description = "Automate vMix with Yamaha TF3 - Automation bridge",
    [string]$Visibility  = "public",
    [string]$ProjectPath = 'W:\Programing\Projects\Automate vmix with yamaha tf3_1'
)

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }

function Write-Fail {
    param($msg)
    Write-Host "  [ERROR] $msg" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ── 0. Move to project ──────────────────────────────────────
Write-Step "Checking project folder..."
if (-not (Test-Path $ProjectPath)) {
    Write-Fail "Project path not found: $ProjectPath"
}
Set-Location $ProjectPath
Write-OK "Working in: $ProjectPath"

# ── 1. Check Git ────────────────────────────────────────────
Write-Step "Checking Git installation..."
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Warn "Git not found. Downloading Git installer..."
    $gitInstaller = "$env:TEMP\git-setup.exe"
    Invoke-WebRequest "https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/Git-2.45.2-64-bit.exe" -OutFile $gitInstaller
    Start-Process $gitInstaller -ArgumentList "/VERYSILENT /NORESTART" -Wait
    $env:PATH += ";C:\Program Files\Git\cmd"
}
Write-OK "Git: $(git --version)"

# ── 2. Create .gitignore ────────────────────────────────────
Write-Step "Creating .gitignore..."
$gitignoreContent = @"
node_modules/
npm-debug.log*
.env
.env.local
dist/
build/
out/
release/
*.exe
logs/
*.log
.DS_Store
Thumbs.db
.vscode/
.idea/
*.tmp
*.temp
"@
Set-Content -Path ".gitignore" -Value $gitignoreContent -Encoding UTF8
Write-OK ".gitignore created"

# ── 3. Bump package.json version ────────────────────────────
Write-Step "Setting version to 1.0.0 in package.json..."
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    $pkg.version = "1.0.0"
    $pkg | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8
    Write-OK "package.json version set to 1.0.0"
} else {
    Write-Warn "No package.json found - skipping version bump"
}

# ── 4. Init git repo ────────────────────────────────────────
Write-Step "Initialising Git repository..."
if (-not (Test-Path ".git")) {
    git init
    git branch -M main
    Write-OK "Git repo initialised"
} else {
    Write-OK "Git repo already exists"
    git branch -M main 2>$null
}

# ── 5. First commit ─────────────────────────────────────────
Write-Step "Staging and committing files..."
git add -A
$status = git status --short
if ($status) {
    git commit -m "feat: Initial release v1.0.0 - Automate vMix with Yamaha TF3"
    Write-OK "Commit created"
} else {
    Write-OK "Nothing to commit"
}
git tag -a "v1.0.0" -m "First stable release" 2>$null

# ── 6. Create GitHub repo ───────────────────────────────────
Write-Step "Creating GitHub repository..."
$remoteExists = git remote get-url origin 2>$null

if ($remoteExists) {
    Write-Warn "Remote 'origin' already set to: $remoteExists"
    Write-Warn "Skipping repo creation - will push to existing remote."
} elseif (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-OK "GitHub CLI found - using gh to create repo"
    gh repo create $RepoName --description "$Description" "--$Visibility" --source=. --remote=origin
} else {
    Write-Warn "GitHub CLI (gh) not found."
    Write-Host ""
    Write-Host "  Option A (recommended): Install GitHub CLI then re-run" -ForegroundColor Yellow
    Write-Host "    winget install --id GitHub.cli" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Option B: Paste a GitHub Personal Access Token now" -ForegroundColor Yellow
    Write-Host "  (Create at: https://github.com/settings/tokens  -  scope: repo)" -ForegroundColor Yellow
    Write-Host ""
    $tokenInput = Read-Host "  Paste your GitHub PAT (or press Enter to abort)"

    if ([string]::IsNullOrWhiteSpace($tokenInput)) {
        Write-Fail "Aborted - no token provided."
    }

    # Get GitHub username
    $headers = @{
        "Authorization" = "token $tokenInput"
        "User-Agent"    = "setup-github-script"
        "Accept"        = "application/vnd.github+json"
    }

    $user = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers
    $username = $user.login
    Write-OK "Authenticated as: $username"

    # Create the repo via API
    $body = @{
        name        = $RepoName
        description = $Description
        private     = ($Visibility -eq "private")
        auto_init   = $false
    } | ConvertTo-Json

    $newRepo = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method POST -Headers $headers -Body $body -ContentType "application/json"

    # Embed token in URL for push auth
    $cloneUrl = $newRepo.clone_url
    $authUrl  = $cloneUrl -replace "https://", "https://$tokenInput@"
    git remote add origin $authUrl
    Write-OK "Repo created: $($newRepo.html_url)"
}

# ── 7. Push ─────────────────────────────────────────────────
Write-Step "Pushing to GitHub..."
git push -u origin main --tags
Write-OK "Push complete!"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Project pushed to GitHub as v1.0.0!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to close"