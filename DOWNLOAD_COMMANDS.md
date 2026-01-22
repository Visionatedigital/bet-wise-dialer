# GitHub CLI Download Commands

## Download v1.0.4 Release

### Download All Assets (Overwrite Existing)
```powershell
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --dir "downloads" --clobber
```

### Download All Assets (Skip Existing Files)
```powershell
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --dir "downloads" --skip-existing
```

### Download Specific Files

**Download just the installer (.exe):**
```powershell
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --pattern "*.exe" --dir "downloads" --clobber
```

**Download just latest.json:**
```powershell
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --pattern "latest.json" --dir "downloads" --clobber
```

**Download just the MSI installer:**
```powershell
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --pattern "*.msi" --dir "downloads" --clobber
```

## Command Options

- `--clobber`: Overwrite existing files
- `--skip-existing`: Skip files that already exist
- `--dir`: Specify download directory
- `--pattern`: Download only files matching pattern (e.g., "*.exe")

## Quick Reference

**Most common command (download everything, overwrite existing):**
```powershell
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --dir "downloads" --clobber
```

