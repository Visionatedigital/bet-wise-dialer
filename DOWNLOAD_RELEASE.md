# Download Latest Release with GitHub CLI

This guide shows how to download the latest release assets using GitHub CLI.

## Prerequisites

1. **GitHub CLI installed**: See `INSTALL_GH_CLI.md` for installation instructions
2. **GitHub CLI authenticated**: Run `gh auth login` if not already authenticated

## Quick Download

### Download Installer and latest.json

```powershell
.\download_latest_release.ps1
```

This will download:
- The installer `.exe` file
- The `latest.json` file

Files are saved to the `downloads/` directory.

### Download All Assets

```powershell
.\download_latest_release.ps1 -DownloadAll
```

### Custom Output Directory

```powershell
.\download_latest_release.ps1 -OutputDir "C:\MyDownloads"
```

## Manual Download with GitHub CLI

### Download Specific File

```powershell
gh release download latest --repo Visionatedigital/bet-wise-dialer --pattern "*.exe"
```

### Download latest.json Only

```powershell
gh release download latest --repo Visionatedigital/bet-wise-dialer --pattern "latest.json"
```

### Download All Assets

```powershell
gh release download latest --repo Visionatedigital/bet-wise-dialer
```

### Download to Specific Directory

```powershell
gh release download latest --repo Visionatedigital/bet-wise-dialer --dir "downloads"
```

## View Release Information

### View Latest Release Details

```powershell
gh release view latest --repo Visionatedigital/bet-wise-dialer
```

### View Release as JSON

```powershell
gh release view latest --repo Visionatedigital/bet-wise-dialer --json tagName,name,body,assets,createdAt
```

### List All Releases

```powershell
gh release list --repo Visionatedigital/bet-wise-dialer
```

## Use Cases

1. **Testing Updates**: Download the latest release to test before distributing
2. **Manual Distribution**: Download and manually distribute to users
3. **Backup**: Keep local copies of all releases
4. **Verification**: Verify that release assets are correctly uploaded

## Troubleshooting

### "gh: command not found"
- Install GitHub CLI: See `INSTALL_GH_CLI.md`

### "Authentication required"
- Run: `gh auth login`
- Follow the prompts to authenticate

### "Release not found"
- Check the repository name: `Visionatedigital/bet-wise-dialer`
- Verify the release exists on GitHub

### "Pattern not found"
- List available assets: `gh release view latest --repo Visionatedigital/bet-wise-dialer`
- Use the exact filename in the `--pattern` flag

