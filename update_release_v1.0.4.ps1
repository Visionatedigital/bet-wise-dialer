# Script to update v1.0.4 release with new installer
# This replaces the old installer with the new one that has auto-updater fixes

$repo = "Visionatedigital/bet-wise-dialer"
$tag = "v1.0.4"
$installerPath = "src-tauri\target\release\bundle\nsis\BetSure Dialer_1.0.4_x64-setup.exe"
$latestJsonPath = "src-tauri\target\release\bundle\latest.json"

Write-Host "Updating v1.0.4 release with new installer..." -ForegroundColor Green
Write-Host ""

# Check if gh is installed
try {
    gh --version | Out-Null
    Write-Host "GitHub CLI found" -ForegroundColor Green
} catch {
    Write-Host "ERROR: GitHub CLI (gh) is not installed!" -ForegroundColor Red
    Write-Host "Please install it from: https://github.com/cli/cli/releases/latest" -ForegroundColor Yellow
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

# Verify files exist
if (-not (Test-Path $installerPath)) {
    Write-Host "ERROR: Installer not found at: $installerPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $latestJsonPath)) {
    Write-Host "ERROR: latest.json not found at: $latestJsonPath" -ForegroundColor Red
    exit 1
}

Write-Host "Files verified:" -ForegroundColor Green
Write-Host "  - Installer: $installerPath" -ForegroundColor Cyan
Write-Host "  - latest.json: $latestJsonPath" -ForegroundColor Cyan
Write-Host ""

# Delete old assets
Write-Host "Deleting old assets from release..." -ForegroundColor Yellow
try {
    gh release delete-asset $tag "BetSure.Dialer_1.0.4_x64-setup.exe" --repo $repo --yes 2>&1 | Out-Null
    Write-Host "  ✓ Deleted old installer" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Old installer not found (may have been deleted already)" -ForegroundColor Yellow
}

try {
    gh release delete-asset $tag "latest.json" --repo $repo --yes 2>&1 | Out-Null
    Write-Host "  ✓ Deleted old latest.json" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Old latest.json not found (may have been deleted already)" -ForegroundColor Yellow
}

Write-Host ""

# Upload new installer (rename to match GitHub naming)
$renamedInstaller = "BetSure.Dialer_1.0.4_x64-setup.exe"
Copy-Item $installerPath $renamedInstaller -Force

Write-Host "Uploading new assets..." -ForegroundColor Yellow
try {
    # Upload installer
    gh release upload $tag $renamedInstaller --repo $repo --clobber
    Write-Host "  ✓ Uploaded new installer" -ForegroundColor Green
    
    # Upload latest.json
    gh release upload $tag $latestJsonPath --repo $repo --clobber
    Write-Host "  ✓ Uploaded updated latest.json" -ForegroundColor Green
    
    # Clean up
    Remove-Item $renamedInstaller -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "✅ Release updated successfully!" -ForegroundColor Green
    Write-Host "Release URL: https://github.com/$repo/releases/tag/$tag" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Users will now get the updated installer with auto-updater fixes!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ Error updating release: $_" -ForegroundColor Red
    Remove-Item $renamedInstaller -ErrorAction SilentlyContinue
    exit 1
}

