# Windows C Drive Cleanup Guide

## Quick Cleanup Methods

### Method 1: Disk Cleanup (Safest)

1. **Open Disk Cleanup:**
   - Press `Win + R`
   - Type: `cleanmgr`
   - Press Enter
   - Select C: drive

2. **Select items to clean:**
   - ✅ Temporary files
   - ✅ Windows Update files
   - ✅ Recycle Bin
   - ✅ Thumbnails
   - ✅ System error memory dump files
   - ✅ Previous Windows installations (if any)

3. **Click "Clean up system files"** (requires admin)
   - This will show more options including Windows Update files

### Method 2: PowerShell Cleanup Script

Run this PowerShell script as Administrator:

```powershell
# Clean Windows Temp
Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean User Temp
Remove-Item "$env:LOCALAPPDATA\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean Browser Cache
Remove-Item "$env:LOCALAPPDATA\Microsoft\Windows\INetCache\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean Windows Update files (requires admin)
Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase

# Clean WinSxS (requires admin)
Dism.exe /online /Cleanup-Image /SPSuperseded
```

### Method 3: Clean Rust/Cargo Cache (If Needed)

If Rust build fails due to space, you can clean Rust cache:

```powershell
# Clean Rust registry cache
Remove-Item "$env:USERPROFILE\.cargo\registry\cache\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean Rust build artifacts (after failed builds)
Remove-Item "$env:USERPROFILE\.cargo\git\*" -Recurse -Force -ErrorAction SilentlyContinue
```

### Method 4: Clean npm Cache

```powershell
npm cache clean --force
```

### Method 5: Storage Sense (Windows 10/11)

1. Open **Settings** → **System** → **Storage**
2. Click **Configure Storage Sense** or **Clean now**
3. Enable automatic cleanup

## What's Safe to Delete

### ✅ Safe to Delete:
- **Temp folders:** `C:\Windows\Temp`, `%TEMP%`
- **Browser cache:** Chrome, Edge, Firefox cache
- **Windows Update files:** Old update files (after successful updates)
- **Recycle Bin:** Empty recycle bin
- **Downloaded program files:** Old installers
- **Thumbnails:** Can be regenerated
- **npm cache:** Can be regenerated
- **Rust registry cache:** Will re-download when needed

### ❌ Don't Delete:
- **Program Files:** Installed applications
- **Windows folder:** System files (except Temp)
- **Users folder:** Personal files
- **System32:** Critical system files

## Quick PowerShell Cleanup Script

Save this as `cleanup.ps1` and run as Administrator:

```powershell
Write-Host "Starting cleanup..." -ForegroundColor Cyan

# Get initial disk space
$before = (Get-PSDrive C).Free / 1GB

# Clean temp folders
Write-Host "Cleaning temp folders..." -ForegroundColor Yellow
Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean browser cache
Write-Host "Cleaning browser cache..." -ForegroundColor Yellow
Remove-Item "$env:LOCALAPPDATA\Microsoft\Windows\INetCache\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean npm cache
Write-Host "Cleaning npm cache..." -ForegroundColor Yellow
npm cache clean --force 2>$null

# Clean Recycle Bin
Write-Host "Emptying Recycle Bin..." -ForegroundColor Yellow
Clear-RecycleBin -Force -ErrorAction SilentlyContinue

# Get final disk space
$after = (Get-PSDrive C).Free / 1GB
$freed = $after - $before

Write-Host "`nCleanup complete!" -ForegroundColor Green
Write-Host "Freed: $([math]::Round($freed, 2)) GB" -ForegroundColor Cyan
Write-Host "Free space now: $([math]::Round($after, 2)) GB" -ForegroundColor Cyan
```

## Check Disk Space After Cleanup

```powershell
Get-PSDrive C | Format-Table Name,@{Name="Used(GB)";Expression={[math]::Round($_.Used/1GB,2)}},@{Name="Free(GB)";Expression={[math]::Round($_.Free/1GB,2)}}
```

## Minimum Space Needed

For Rust/Tauri build, you need approximately:
- **Rust toolchain:** ~1-2 GB
- **Build artifacts:** ~500 MB - 1 GB
- **Node modules:** ~200-500 MB
- **Total:** ~2-4 GB free space recommended

## After Cleanup

Once you have enough space:
1. Restart your terminal
2. Navigate to project: `cd bet-wise-dialer`
3. Run build: `npm run tauri:build`

