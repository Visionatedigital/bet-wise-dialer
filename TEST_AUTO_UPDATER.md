# Testing the Auto-Updater

This guide explains how to test if the "Install now" button is working correctly.

## How to Test

### 1. Open Browser Console

**In Tauri Desktop App:**
- The console is available in development mode
- Or use DevTools if enabled

**To see console logs:**
- Press `F12` or `Ctrl+Shift+I` (if DevTools are enabled)
- Or check the terminal where you ran `npm run tauri:dev`

### 2. Click "Install now"

When you click "Install now", you should see:

#### In the Console:
```
[Updater] downloadAndInstall called
[Updater] Current version: 1.0.5
[Updater] Update info: { version: "1.0.6", ... }
[Updater] Stored Tauri update object: { available: true, version: "1.0.6", install: [Function], ... }
[Updater] Running in Tauri, using updater plugin
[Updater] Using update object: { available: true, version: "1.0.6", hasInstall: true, isStored: true }
[Updater] Update object details: { available: true, version: "1.0.6", hasInstall: true, ... }
[Updater] Starting installation...
[Updater] Calling update.install()...
[Updater] Installation completed successfully!
[Updater] Scheduling app restart in 2 seconds...
[Updater] Relaunching app now...
```

**Key New Logs to Look For:**
- `[Updater] Stored Tauri update object:` - Shows the update object was stored correctly
- `[Updater] Using update object: { isStored: true }` - Confirms we're using the stored object (not calling check() again)

#### Visual Feedback:
1. **Toast Notification**: "Downloading and installing update..."
2. **Progress Bar**: Shows 50% then 100%
3. **Toast Notification**: "Update installed! Restarting app in 2 seconds..."
4. **App Closes**: The app should close automatically
5. **App Restarts**: The app should restart with the new version

### 3. Verify It Worked

After the app restarts:

1. **Check Version in Settings**:
   - Go to Settings → General → Application Updates
   - Should show "v1.0.5" (or the new version)

2. **Check Console on Startup**:
   - Look for: `[Updater] Current version: 1.0.5`

3. **Check if Update Dialog Appears Again**:
   - It should NOT appear (because you accepted it)
   - Check localStorage: `localStorage.getItem('acceptedUpdate')` should be "1.0.5"

## What to Look For

### ✅ Success Indicators:
- Console shows "Installation completed successfully!"
- Toast shows "Update installed! Restarting app..."
- App closes and restarts automatically
- New version number appears in Settings
- Update dialog doesn't reappear

### ❌ Failure Indicators:
- Console shows error messages
- Toast shows "Installation failed..."
- App doesn't restart
- Browser/download page opens instead
- Console shows "Install method not available"

## Troubleshooting

### If "Install method not available" appears:
- The Tauri updater plugin might not be properly configured
- Check that `latest.json` is accessible at the endpoint
- Verify the release exists on GitHub

### If installation fails:
- Check console for error details
- Verify you have write permissions
- Check if antivirus is blocking the installation
- Ensure the installer file exists on GitHub

### If app doesn't restart:
- Check console for "Relaunching app now..." message
- The `relaunch()` function might need permissions
- Try manually restarting the app to verify the update installed

## Testing Checklist

### Before Installation:
- [ ] Update dialog appears when update is available
- [ ] Console shows: `[Updater] Update object details: { hasInstall: true }`
- [ ] Console shows: `[Updater] Update available via Tauri updater: [version]`
- [ ] Update object is stored (check for `setTauriUpdate` in logs)

### During Installation:
- [ ] Console shows: `[Updater] downloadAndInstall called`
- [ ] Console shows: `[Updater] Stored Tauri update object: { ... }`
- [ ] Console shows: `[Updater] Using update object: { isStored: true }`
- [ ] **CRITICAL**: Should NOT see "No stored update object, checking again..."
- [ ] Dialog closes immediately when "Install now" is clicked
- [ ] Toast notification: "Downloading and installing update..."
- [ ] Progress bar updates (50% → 100%)
- [ ] Console shows: `[Updater] Calling update.install()...`
- [ ] Console shows: `[Updater] Installation completed successfully!`

### After Installation:
- [ ] Toast: "Update installed! Restarting app in 2 seconds..."
- [ ] App closes automatically
- [ ] App restarts automatically
- [ ] New version number appears in Settings
- [ ] Console on startup shows: `[Updater] Current version: [new version]`
- [ ] Update dialog doesn't reappear
- [ ] localStorage has: `acceptedUpdate` = new version
- [ ] All features work in new version
- [ ] Manager Hub shows correctly (not "Management Dashboard")

## Quick Test Commands

### Check if update object is stored:
Open browser console and run:
```javascript
// This won't work directly, but check the console logs when update is found
// Look for: [Updater] Update object details: { hasInstall: true }
```

### Clear update state (for re-testing):
```javascript
localStorage.removeItem('acceptedUpdate');
localStorage.removeItem('dismissedUpdate');
// Then restart app or click "Check for Updates" again
```

### Verify version:
```javascript
// In console after app starts
console.log('Current version:', localStorage.getItem('acceptedUpdate'));
```

## Manual Testing Steps

### Method 1: Test with Real Update (Recommended)

1. **Build and install an older version** (e.g., v1.0.4)
   ```bash
   # Change version in tauri.conf.json to 1.0.4
   # Change CURRENT_VERSION in useAutoUpdate.ts to 1.0.4
   npm run tauri:build
   # Install the built version
   ```

2. **Ensure a newer version exists** on GitHub (e.g., v1.0.5 or higher)
   - Make sure `latest.json` is accessible at: `https://github.com/Visionatedigital/bet-wise-dialer/releases/latest/download/latest.json`

3. **Open the installed app** (not dev mode)
   - Update dialog should appear automatically after 3 seconds
   - Or go to Settings → General → Application Updates → Click "Check for Updates"

4. **Open console/DevTools**
   - Press `F12` or `Ctrl+Shift+I` (if DevTools enabled)
   - Or check terminal if running in dev mode

5. **Verify update object is stored** (before clicking install)
   - Look for: `[Updater] Update object details: { hasInstall: true, ... }`
   - Look for: `[Updater] Update available via Tauri updater: 1.0.5`

6. **Click "Install now"**
   - Dialog should close immediately
   - Watch console logs carefully

7. **Verify stored object is used**
   - Look for: `[Updater] Stored Tauri update object: { ... }`
   - Look for: `[Updater] Using update object: { isStored: true }`
   - **Important**: Should NOT see "No stored update object, checking again..."

8. **Watch installation progress**
   - Toast: "Downloading and installing update..."
   - Progress bar: 50% → 100%
   - Console: "Installation completed successfully!"

9. **Wait for app restart** - should happen automatically after 2 seconds

10. **Verify new version** - check Settings or console logs

### Method 2: Test in Development Mode (Limited)

**Note:** The updater works best in production builds, but you can test the flow:

1. **Run in dev mode:**
   ```bash
   npm run tauri:dev
   ```

2. **Manually trigger update check:**
   - Go to Settings → General → Application Updates
   - Click "Check for Updates"

3. **Check console logs:**
   - Should see update check logs
   - If update available, dialog will appear
   - Click "Install now" to test the flow

4. **Verify stored update object:**
   - Check console for `[Updater] Stored Tauri update object`
   - Check for `isStored: true` in logs

**Limitation:** In dev mode, the actual installation may not work, but you can verify:
- Update object is stored correctly
- Installation function is called
- Error handling works

## Expected Behavior

When working correctly:
1. User clicks "Install now"
2. Dialog closes immediately
3. Toast: "Downloading and installing update..."
4. Progress bar shows 50%
5. Installation happens in background
6. Progress bar shows 100%
7. Toast: "Update installed! Restarting app..."
8. App closes
9. App restarts with new version
10. User is logged in (if they were before)
11. Update dialog doesn't appear again

