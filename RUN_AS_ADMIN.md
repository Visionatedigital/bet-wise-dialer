# Running DISM Cleanup as Administrator

## Method 1: Open PowerShell as Administrator

1. **Press `Win + X`**
2. Select **"Windows PowerShell (Admin)"** or **"Terminal (Admin)"**
3. Click **Yes** when prompted by UAC
4. Run the command:
   ```powershell
   Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase
   ```

## Method 2: From Current PowerShell

Run this command to open a new admin PowerShell window:
```powershell
Start-Process powershell -Verb RunAs
```

Then in the new admin window, run:
```powershell
Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase
```

## Method 3: Using Command Prompt (Admin)

1. Press `Win + R`
2. Type: `cmd`
3. Press `Ctrl + Shift + Enter` (opens as admin)
4. Run:
   ```
   Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase
   ```

## What This Command Does

- **StartComponentCleanup**: Removes old component versions
- **ResetBase**: Resets the component store base, removing all superseded versions

**This can free 2-10 GB** depending on how many Windows updates you have.

## After Running DISM

1. Wait for it to complete (may take 10-30 minutes)
2. Check your free space:
   ```powershell
   Get-PSDrive C | Format-Table Name,@{Name="Free(GB)";Expression={[math]::Round($_.Free/1GB,2)}}
   ```
3. Once you have 3-4 GB free, run the build:
   ```powershell
   cd bet-wise-dialer
   npm run tauri:build
   ```

## Alternative: Use Disk Cleanup (Easier)

If DISM seems complicated, use Disk Cleanup instead:

1. Press `Win + R`
2. Type: `cleanmgr`
3. Select C: drive
4. Click **"Clean up system files"** (requires admin)
5. Check **"Windows Update files"** and other items
6. Click OK

This is easier and also frees up space!

