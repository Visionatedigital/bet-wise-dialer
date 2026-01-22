# Publishing v1.0.6 - Version 6 Release

This guide will help you publish the new version 6 release.

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
- Change version to `1.0.6`
- Update the URL to point to v1.0.6
- Update the pub_date

### 3. Create GitHub Release

```powershell
.\create_release_v1.0.6.ps1
```

This will:
- Verify all files exist
- Create the v1.0.6 release on GitHub
- Upload the installer and latest.json

## What's New in v1.0.6

- ✅ **Performance Improvements**: Optimized startup time and memory management
- ✅ **Stability Enhancements**: Better error handling and crash prevention
- ✅ **Technical Updates**: Updated versioning across all components

## After Publishing

Users on previous versions will:
1. Be automatically notified of the update
2. Click "Install now" to download and install
3. The app will restart with v1.0.6
4. All existing data and settings will be preserved

## Quick Command Sequence

```powershell
# 1. Build
npm run tauri:build

# 2. Update latest.json
.\update_latest_json.ps1

# 3. Create release
.\create_release_v1.0.6.ps1
```
