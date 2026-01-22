# Script to check releases and download the latest one
# This helps troubleshoot "release not found" issues

$repo = "Visionatedigital/bet-wise-dialer"

Write-Host "Checking releases for $repo..." -ForegroundColor Green
Write-Host ""

# List all releases
Write-Host "All releases:" -ForegroundColor Yellow
gh release list --repo $repo

Write-Host ""

# Try to view the latest release
Write-Host "Attempting to view 'latest' release..." -ForegroundColor Yellow
try {
    $latest = gh release view latest --repo $repo --json tagName,name,isDraft,isPrerelease,assets
    $latestJson = $latest | ConvertFrom-Json
    
    Write-Host "✓ Found latest release: $($latestJson.tagName)" -ForegroundColor Green
    Write-Host "  Name: $($latestJson.name)" -ForegroundColor Cyan
    Write-Host "  Draft: $($latestJson.isDraft)" -ForegroundColor Cyan
    Write-Host "  Prerelease: $($latestJson.isPrerelease)" -ForegroundColor Cyan
    Write-Host "  Assets: $($latestJson.assets.Count)" -ForegroundColor Cyan
    
    if ($latestJson.assets.Count -gt 0) {
        Write-Host "`nAvailable assets:" -ForegroundColor Yellow
        foreach ($asset in $latestJson.assets) {
            Write-Host "  - $($asset.name) ($([math]::Round($asset.size / 1MB, 2)) MB)" -ForegroundColor White
        }
        
        Write-Host "`nDownloading assets..." -ForegroundColor Yellow
        gh release download latest --repo $repo --dir "downloads"
        Write-Host "✓ Download complete!" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Could not find 'latest' release" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Trying to download by tag name (v1.0.4)..." -ForegroundColor Yellow
    
    try {
        gh release download v1.0.4 --repo $repo --dir "downloads"
        Write-Host "✓ Downloaded v1.0.4 successfully!" -ForegroundColor Green
    } catch {
        Write-Host "✗ Could not download v1.0.4" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Note: If 'latest' doesn't work, try downloading by specific tag:" -ForegroundColor Cyan
Write-Host "  gh release download v1.0.4 --repo $repo" -ForegroundColor White

