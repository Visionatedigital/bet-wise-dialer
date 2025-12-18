# Safe Windows Cleanup Script
# Run this script to free up disk space

Write-Host "=== Windows Cleanup Script ===" -ForegroundColor Cyan
Write-Host ""

# Get initial disk space
$before = (Get-PSDrive C).Free / 1GB
Write-Host "Starting free space: $([math]::Round($before, 2)) GB" -ForegroundColor Yellow
Write-Host ""

# 1. Clean User Temp folder
Write-Host "1. Cleaning User Temp folder..." -ForegroundColor Yellow
$userTemp = "$env:LOCALAPPDATA\Temp"
if (Test-Path $userTemp) {
    $count = (Get-ChildItem $userTemp -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
    Remove-Item "$userTemp\*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   Cleaned $count items" -ForegroundColor Green
}

# 2. Clean Windows Temp folder (requires admin)
Write-Host "2. Cleaning Windows Temp folder..." -ForegroundColor Yellow
$winTemp = "C:\Windows\Temp"
if (Test-Path $winTemp) {
    try {
        Remove-Item "$winTemp\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "   Cleaned Windows Temp" -ForegroundColor Green
    } catch {
        Write-Host "   Requires admin privileges" -ForegroundColor Yellow
    }
}

# 3. Clean Browser Cache
Write-Host "3. Cleaning Browser Cache..." -ForegroundColor Yellow
$browserCache = "$env:LOCALAPPDATA\Microsoft\Windows\INetCache"
if (Test-Path $browserCache) {
    Remove-Item "$browserCache\*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   Cleaned browser cache" -ForegroundColor Green
}

# 4. Clean npm cache
Write-Host "4. Cleaning npm cache..." -ForegroundColor Yellow
try {
    npm cache clean --force 2>$null
    Write-Host "   Cleaned npm cache" -ForegroundColor Green
} catch {
    Write-Host "   npm not found or already clean" -ForegroundColor Yellow
}

# 5. Empty Recycle Bin
Write-Host "5. Emptying Recycle Bin..." -ForegroundColor Yellow
try {
    Clear-RecycleBin -Force -ErrorAction SilentlyContinue
    Write-Host "   Emptied Recycle Bin" -ForegroundColor Green
} catch {
    Write-Host "   Recycle Bin already empty or requires admin" -ForegroundColor Yellow
}

# 6. Clean Rust registry cache (optional - will re-download when needed)
Write-Host "6. Checking Rust cache..." -ForegroundColor Yellow
$rustCache = "$env:USERPROFILE\.cargo\registry\cache"
if (Test-Path $rustCache) {
    $rustSize = (Get-ChildItem $rustCache -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB
    Write-Host "   Rust cache size: $([math]::Round($rustSize, 2)) GB" -ForegroundColor Yellow
    $response = Read-Host "   Delete Rust cache? (y/n) - Will re-download when needed"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Remove-Item "$rustCache\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "   Cleaned Rust cache" -ForegroundColor Green
    }
}

# Get final disk space
$after = (Get-PSDrive C).Free / 1GB
$freed = $after - $before

Write-Host ""
Write-Host "=== Cleanup Complete! ===" -ForegroundColor Green
Write-Host "Freed: $([math]::Round($freed, 2)) GB" -ForegroundColor Cyan
Write-Host "Free space now: $([math]::Round($after, 2)) GB" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: For more cleanup options, run Disk Cleanup (cleanmgr)" -ForegroundColor Yellow

