# Update v1.0.4 Release with New Installer

The new installer includes the auto-updater fix. You need to update the existing v1.0.4 release on GitHub.

## Option 1: Update Existing Release (Recommended)

### Using GitHub CLI

```powershell
# Navigate to project directory
cd "C:\Users\LUBS\Downloads\Betsure_dialer\bet-wise-dialer"

# Delete old assets and upload new ones
gh release delete-asset v1.0.4 "BetSure.Dialer_1.0.4_x64-setup.exe" --repo Visionatedigital/bet-wise-dialer --yes
gh release delete-asset v1.0.4 "latest.json" --repo Visionatedigital/bet-wise-dialer --yes

# Upload new installer
gh release upload v1.0.4 "src-tauri\target\release\bundle\nsis\BetSure Dialer_1.0.4_x64-setup.exe" --repo Visionatedigital/bet-wise-dialer --clobber

# Upload updated latest.json
gh release upload v1.0.4 "src-tauri\target\release\bundle\latest.json" --repo Visionatedigital/bet-wise-dialer --clobber
```

### Using GitHub Web Interface

1. Go to: https://github.com/Visionatedigital/bet-wise-dialer/releases/tag/v1.0.4
2. Click **"Edit release"**
3. Scroll down to **"Attachments"**
4. Delete the old `BetSure.Dialer_1.0.4_x64-setup.exe` and `latest.json`
5. Upload the new files:
   - `src-tauri\target\release\bundle\nsis\BetSure Dialer_1.0.4_x64-setup.exe`
   - `src-tauri\target\release\bundle\latest.json`
6. Click **"Update release"**

## Option 2: Create New Release (v1.0.5)

If you prefer to create a new release instead:

1. Update version in code:
   - `src-tauri/tauri.conf.json`: Change `"version": "1.0.4"` to `"version": "1.0.5"`
   - `src/hooks/useAutoUpdate.ts`: Change `CURRENT_VERSION = '1.0.4'` to `CURRENT_VERSION = '1.0.5'`
   - Update `latest.json` version to `1.0.5`

2. Rebuild:
   ```powershell
   npm run tauri:build
   ```

3. Create new release:
   ```powershell
   .\create_release_gh_cli.ps1
   ```
   (Update the script to use v1.0.5)

## What Changed

The new installer includes:
- ✅ Fixed auto-updater that automatically installs updates (not just opens download page)
- ✅ Improved update dialog with progress indication
- ✅ Better error handling and user feedback

## After Updating

Users who already have v1.0.4 installed will:
- See the update notification
- When they click "Install now", the update will automatically download and install
- The app will restart with the new version

