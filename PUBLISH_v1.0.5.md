# Publishing v1.0.5 - Sign Out Fix

This guide will help you publish the new version with the sign-out fix.

## Steps to Publish

### 1. Build the Application

```powershell
npm run tauri:build
```

This will:
- Build the frontend
- Compile the Tauri application
- Create the installer in `src-tauri\target\release\bundle\nsis\`

### 2. Update latest.json

After the build completes, update the latest.json file:

```powershell
.\update_latest_json.ps1
```

Or manually update `src-tauri\target\release\bundle\latest.json`:
- Change version to `1.0.5`
- Update the URL to point to v1.0.5
- Update the pub_date

### 3. Create GitHub Release

```powershell
.\create_release_v1.0.5.ps1
```

This will:
- Verify all files exist
- Create the v1.0.5 release on GitHub
- Upload the installer and latest.json

## What's Fixed in v1.0.5

- ✅ **Sign Out Issue**: Users can now properly sign out without being redirected back to dashboard
- ✅ **Auto-Updater**: Automatically installs updates (from v1.0.4)

## After Publishing

Users on v1.0.4 will:
1. Be automatically notified of the update
2. Click "Install now" to download and install
3. The app will restart with v1.0.5
4. Sign out will now work correctly

## Quick Command Sequence

```powershell
# 1. Build
npm run tauri:build

# 2. Update latest.json
.\update_latest_json.ps1

# 3. Create release
.\create_release_v1.0.5.ps1
```

