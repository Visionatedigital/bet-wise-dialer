# Script to create GitHub release using GitHub CLI
# Prerequisites: GitHub CLI must be installed and authenticated

Write-Host "Creating GitHub Release v1.0.4..." -ForegroundColor Green

# Check if gh is installed
try {
    $ghVersion = gh --version
    Write-Host "GitHub CLI found: $($ghVersion -split "`n" | Select-Object -First 1)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: GitHub CLI (gh) is not installed!" -ForegroundColor Red
    Write-Host "Please install it from: https://github.com/cli/cli/releases/latest" -ForegroundColor Yellow
    Write-Host "Or see INSTALL_GH_CLI.md for instructions" -ForegroundColor Yellow
    exit 1
}

# Check authentication
try {
    gh auth status | Out-Null
    Write-Host "GitHub CLI authenticated" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Not authenticated with GitHub CLI!" -ForegroundColor Red
    Write-Host "Run: gh auth login" -ForegroundColor Yellow
    exit 1
}

# File paths
$installerPath = "src-tauri\target\release\bundle\nsis\BetSure Dialer_1.0.4_x64-setup.exe"
$latestJsonPath = "src-tauri\target\release\bundle\latest.json"
$releaseNotesPath = "RELEASE_NOTES_v1.0.4.md"

# Verify files exist
if (-not (Test-Path $installerPath)) {
    Write-Host "ERROR: Installer not found at: $installerPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $latestJsonPath)) {
    Write-Host "ERROR: latest.json not found at: $latestJsonPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $releaseNotesPath)) {
    Write-Host "ERROR: Release notes not found at: $releaseNotesPath" -ForegroundColor Red
    exit 1
}

Write-Host "`nFiles verified:" -ForegroundColor Green
Write-Host "  - Installer: $installerPath" -ForegroundColor Cyan
Write-Host "  - latest.json: $latestJsonPath" -ForegroundColor Cyan
Write-Host "  - Release notes: $releaseNotesPath" -ForegroundColor Cyan

# Create release with GitHub CLI
Write-Host "`nCreating release..." -ForegroundColor Yellow

# Rename installer for upload (GitHub CLI will use the filename)
$renamedInstaller = "BetSure.Dialer_1.0.4_x64-setup.exe"
Copy-Item $installerPath $renamedInstaller -Force

try {
    gh release create v1.0.4 `
        --title "v1.0.4 - Agent Lead Filtering Fix" `
        --notes-file $releaseNotesPath `
        "$renamedInstaller" `
        "$latestJsonPath"
    
    Write-Host "`n✅ Release created successfully!" -ForegroundColor Green
    Write-Host "Release URL: https://github.com/Visionatedigital/bet-wise-dialer/releases/tag/v1.0.4" -ForegroundColor Cyan
    
    # Clean up renamed file
    Remove-Item $renamedInstaller -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "`n❌ Error creating release: $_" -ForegroundColor Red
    Remove-Item $renamedInstaller -ErrorAction SilentlyContinue
    exit 1
}

