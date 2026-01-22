# Quick script to download v1.0.4 release assets
# Since the release is published, we can download by tag name

$repo = "Visionatedigital/bet-wise-dialer"
$tag = "v1.0.4"
$outputDir = "downloads"

Write-Host "Downloading v1.0.4 release assets..." -ForegroundColor Green
Write-Host ""

# Create downloads directory if it doesn't exist
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
    Write-Host "Created directory: $outputDir" -ForegroundColor Cyan
}

# Download all assets (overwrite existing files)
Write-Host "Downloading all assets from $tag..." -ForegroundColor Yellow
gh release download $tag --repo $repo --dir $outputDir --clobber

Write-Host ""
Write-Host "✓ Download complete!" -ForegroundColor Green
Write-Host "Files saved to: $((Resolve-Path $outputDir).Path)" -ForegroundColor Cyan
Write-Host ""

# List downloaded files
Write-Host "Downloaded files:" -ForegroundColor Yellow
Get-ChildItem $outputDir | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 2)
    $sizeText = $sizeMB.ToString() + " MB"
    Write-Host "  - $($_.Name) ($sizeText)" -ForegroundColor White
}

