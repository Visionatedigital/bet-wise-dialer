# DISM Command - Correct Syntax

## The Issue
When PowerShell can't find `Dism.exe`, use one of these methods:

## Method 1: Use .\Dism.exe (Since you're in system32)
```powershell
.\Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase
```

## Method 2: Use Full Path
```powershell
C:\Windows\System32\Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase
```

## Method 3: Use DISM without .exe
```powershell
DISM /online /Cleanup-Image /StartComponentCleanup /ResetBase
```

## Copy-Paste Ready Command

Copy this entire line into your admin PowerShell:

```powershell
C:\Windows\System32\Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase
```

## What to Expect

- The command will show progress
- It may take 10-30 minutes
- You'll see messages like "Cleaning up component store..."
- When done, it will show how much space was freed

## After Completion

Check your free space:
```powershell
Get-PSDrive C | Format-Table Name,@{Name="Free(GB)";Expression={[math]::Round($_.Free/1GB,2)}}
```

## Alternative: Disk Cleanup (Easier)

If DISM is giving you trouble, use Disk Cleanup instead:

1. Press `Win + R`
2. Type: `cleanmgr`
3. Select C: drive
4. Click **"Clean up system files"**
5. Check **"Windows Update files"**
6. Click OK

This is simpler and also works well!

