# Troubleshooting GitHub Release Downloads

## Issue: "release not found" when using `latest`

This can happen if:
1. The release is a draft (not published)
2. The release is marked as a pre-release
3. There's no release marked as "latest" on GitHub

## Solutions

### 1. Check All Releases

```powershell
gh release list --repo Visionatedigital/bet-wise-dialer
```

This shows all releases with their tags.

### 2. Download by Specific Tag

Instead of using `latest`, use the specific tag:

```powershell
# Download v1.0.4 specifically
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer

# Download specific file from v1.0.4
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --pattern "*.exe"
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --pattern "latest.json"
```

### 3. View Release Details

```powershell
# View latest release
gh release view latest --repo Visionatedigital/bet-wise-dialer

# View specific release
gh release view v1.0.4 --repo Visionatedigital/bet-wise-dialer

# View as JSON (shows if it's draft/prerelease)
gh release view v1.0.4 --repo Visionatedigital/bet-wise-dialer --json tagName,isDraft,isPrerelease,assets
```

### 4. Publish Draft Release

If the release is a draft, publish it:

```powershell
gh release edit v1.0.4 --repo Visionatedigital/bet-wise-dialer --draft=false
```

### 5. Mark as Latest Release

On GitHub web interface:
1. Go to https://github.com/Visionatedigital/bet-wise-dialer/releases
2. Find the release you want to be "latest"
3. Click "Edit"
4. Uncheck "Set as the latest release" if checked, then check it again
5. Or uncheck "This is a pre-release" if it's marked as pre-release

### 6. Use the Troubleshooting Script

Run the script to automatically check and download:

```powershell
.\check_and_download_release.ps1
```

## Common Commands

```powershell
# List all releases
gh release list --repo Visionatedigital/bet-wise-dialer

# Download all assets from v1.0.4
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer

# Download to specific directory
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --dir "downloads"

# Download specific file
gh release download v1.0.4 --repo Visionatedigital/bet-wise-dialer --pattern "BetSure*.exe"

# View release info
gh release view v1.0.4 --repo Visionatedigital/bet-wise-dialer
```

## Why "latest" Might Not Work

GitHub's "latest" release is determined by:
1. The most recent **published** (non-draft) release
2. That is **not** a pre-release
3. Or the most recent release if no non-pre-release exists

If v1.0.4 is a draft or pre-release, it won't be considered "latest".

