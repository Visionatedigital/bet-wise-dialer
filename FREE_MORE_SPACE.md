# Free More Disk Space - Quick Guide

## Current Status
- **Freed:** ~1 GB
- **Current free:** 1.83 GB
- **Needed:** 3-4 GB for Rust build

## Method 1: Disk Cleanup (Easiest - Just Opened)

The Disk Cleanup tool should have opened. If not:
1. Press `Win + R`
2. Type: `cleanmgr`
3. Select C: drive
4. **Click "Clean up system files"** (important!)
5. Check these items:
   - ✅ Windows Update files (can be several GB)
   - ✅ Previous Windows installations
   - ✅ Temporary files
   - ✅ System error memory dump files
6. Click OK

## Method 2: Clean Windows Update Files (Admin Required)

Open PowerShell as Administrator and run:

```powershell
# Clean Windows Update files
Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase

# Clean WinSxS (component store)
Dism.exe /online /Cleanup-Image /SPSuperseded
```

This can free **2-10 GB** depending on your system.

## Method 3: Storage Sense (Windows 10/11)

1. Open **Settings** → **System** → **Storage**
2. Click **Temporary files**
3. Check all items and click **Remove files**
4. Go back and click **Configure Storage Sense**
5. Enable automatic cleanup

## Method 4: Uninstall Unused Programs

1. Open **Settings** → **Apps** → **Apps & features**
2. Sort by size
3. Uninstall programs you don't use

## Method 5: Move Files to Another Drive

If you have another drive (D:, E:, etc.):
- Move Downloads folder
- Move Documents/Pictures/Videos
- Move large files temporarily

## Check Space After Cleanup

```powershell
Get-PSDrive C | Format-Table Name,@{Name="Used(GB)";Expression={[math]::Round($_.Used/1GB,2)}},@{Name="Free(GB)";Expression={[math]::Round($_.Free/1GB,2)}}
```

## Once You Have 3-4 GB Free

Run the build:
```powershell
cd bet-wise-dialer
npm run tauri:build
```

