# Delete WhatsApp Data - Quick Guide

## Found: 10.6 GB of WhatsApp Data!

**Location:** `C:\Users\LUBS\AppData\Local\Packages\5319275A.WhatsAppDesktop_cv1g1gvanyjgm`

## ⚠️ Warning
Deleting this will remove:
- All chat history
- All media files (photos, videos, documents)
- All backups
- You'll need to set up WhatsApp again

## Method 1: Reset WhatsApp (Recommended - Keeps App)

1. Press `Win + I` to open Settings
2. Go to **Apps** → **Apps & features**
3. Search for "WhatsApp"
4. Click on **WhatsApp**
5. Click **Advanced options**
6. Click **Reset** button
7. Confirm the reset

This keeps WhatsApp installed but deletes all data (~10.6 GB freed)

## Method 2: Uninstall Completely

1. Press `Win + I` to open Settings
2. Go to **Apps** → **Apps & features**
3. Search for "WhatsApp"
4. Click on **WhatsApp**
5. Click **Uninstall**
6. Confirm

This removes WhatsApp and all data (~10.6 GB freed)

## Method 3: Manual Deletion (PowerShell)

**⚠️ Close WhatsApp first!**

Run this in PowerShell:
```powershell
# Close WhatsApp if running
Stop-Process -Name "WhatsApp" -Force -ErrorAction SilentlyContinue

# Delete WhatsApp data
Remove-Item "C:\Users\LUBS\AppData\Local\Packages\5319275A.WhatsAppDesktop_cv1g1gvanyjgm" -Recurse -Force -ErrorAction SilentlyContinue

# Verify deletion
if (-not (Test-Path "C:\Users\LUBS\AppData\Local\Packages\5319275A.WhatsAppDesktop_cv1g1gvanyjgm")) {
    Write-Host "✓ WhatsApp data deleted successfully!" -ForegroundColor Green
}
```

## After Deletion

Check your free space:
```powershell
Get-PSDrive C | Format-Table Name,@{Name="Free(GB)";Expression={[math]::Round($_.Free/1GB,2)}}
```

You should have **~12.6 GB free** (2 GB current + 10.6 GB from WhatsApp)

## Then Build the Installer

Once you have enough space:
```powershell
cd bet-wise-dialer
npm run tauri:build
```

