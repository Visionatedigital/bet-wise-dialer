# Script to update latest.json after build
# This should be run after npm run tauri:build completes

$latestJsonPath = "src-tauri\target\release\bundle\latest.json"
$version = "1.0.6"

if (-not (Test-Path $latestJsonPath)) {
    Write-Host "ERROR: latest.json not found at: $latestJsonPath" -ForegroundColor Red
    Write-Host "Make sure you've run: npm run tauri:build" -ForegroundColor Yellow
    exit 1
}

$latestJson = @{
    version = $version
    notes = "Version 6 Release - Enhanced performance and stability improvements."
    pub_date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    platforms = @{
        "windows-x86_64" = @{
            signature = ""
            url = "https://github.com/Visionatedigital/bet-wise-dialer/releases/download/v$version/BetSure.Dialer_$($version)_x64-setup.exe"
        }
    }
} | ConvertTo-Json -Depth 10

$latestJson | Out-File -FilePath $latestJsonPath -Encoding utf8 -NoNewline

Write-Host "Updated latest.json to version $version" -ForegroundColor Green
Write-Host "Path: $latestJsonPath" -ForegroundColor Cyan
