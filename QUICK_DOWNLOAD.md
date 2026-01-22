# Quick Download Guide for v1.0.4

The release v1.0.4 is published and ready to download. Here are the quickest ways:

## Option 1: Download All Assets (Recommended)

```powershell
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --dir "downloads"
```

This downloads:
- `BetSure.Dialer_1.0.4_x64-setup.exe` (NSIS installer - 5.3 MB)
- `BetSure.Dialer_1.0.4_x64_en-US.msi` (MSI installer - 6.4 MB)
- `latest.json` (Tauri updater manifest - 415 bytes)

## Option 2: Use the Script

```powershell
.\download_v1.0.4.ps1
```

## Option 3: Download Specific Files

### Download just the NSIS installer (.exe)
```powershell
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --pattern "*.exe" --dir "downloads"
```

### Download just the MSI installer
```powershell
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --pattern "*.msi" --dir "downloads"
```

### Download just latest.json
```powershell
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --pattern "latest.json" --dir "downloads"
```

## Direct Download URLs

You can also download directly from these URLs:

- **NSIS Installer**: https://github.com/Visionatedigital/bet-wise-dialer/releases/download/v1.0.4/BetSure.Dialer_1.0.4_x64-setup.exe
- **MSI Installer**: https://github.com/Visionatedigital/bet-wise-dialer/releases/download/v1.0.4/BetSure.Dialer_1.0.4_x64_en-US.msi
- **latest.json**: https://github.com/Visionatedigital/bet-wise-dialer/releases/download/v1.0.4/latest.json

## Why "latest" Might Not Work

Even though the release is published, GitHub's `latest` keyword can sometimes be finicky. Using the specific tag `v1.0.4` is more reliable.

## Verify Download

After downloading, verify the files:

```powershell
Get-ChildItem downloads
```

You should see:
- BetSure.Dialer_1.0.4_x64-setup.exe
- BetSure.Dialer_1.0.4_x64_en-US.msi
- latest.json

