# Quick Test Guide - Installation Functionality

## 🚀 Fastest Way to Test (5 minutes)

### Step 1: Open the App in Dev Mode
```bash
cd bet-wise-dialer
npm run tauri:dev
```

### Step 2: Open Console
- Press `F12` or `Ctrl+Shift+I` to open DevTools
- Or watch the terminal where you ran `npm run tauri:dev`

### Step 3: Trigger Update Check
1. Go to **Settings** → **General** → **Application Updates**
2. Click **"Check for Updates"** button
3. Watch the console logs

### Step 4: What to Look For in Console

**When update check runs, you should see:**
```
[Updater] Checking for updates... Current version: 1.0.5
[Updater] Update available via Tauri updater: [version]
[Updater] Update object details: { available: true, version: "...", hasInstall: true, ... }
```

**✅ KEY SUCCESS INDICATOR:** 
- Look for `hasInstall: true` - this means the update object has the install method
- Look for `setTauriUpdate` or confirmation that update object is stored

### Step 5: If Update Dialog Appears

1. **Before clicking "Install now":**
   - Check console for: `[Updater] Update object details: { hasInstall: true }`
   - This confirms the update object is ready

2. **Click "Install now"**

3. **Watch console - you should see:**
   ```
   [Updater] downloadAndInstall called
   [Updater] Stored Tauri update object: { available: true, ... }
   [Updater] Using update object: { isStored: true, hasInstall: true }
   [Updater] Starting installation...
   [Updater] Calling update.install()...
   ```

4. **✅ CRITICAL CHECK:**
   - Should see: `isStored: true` 
   - Should NOT see: `"No stored update object, checking again..."`
   - This confirms we're using the stored object (not calling check() again)

### Step 6: Verify Installation Flow

**Expected behavior:**
- Dialog closes immediately
- Toast: "Downloading and installing update..."
- Progress bar shows 50% → 100%
- Console: "Installation completed successfully!"
- Toast: "Update installed! Restarting app in 2 seconds..."

**Note:** In dev mode, the actual restart may not work, but you can verify:
- ✅ Update object is stored correctly
- ✅ Stored object is used (not checking again)
- ✅ Install function is called
- ✅ Error handling works

## 🧪 Testing with Real Update (Full Test)

### Prerequisites:
1. You need an older version installed (e.g., v1.0.4)
2. A newer version must exist on GitHub (e.g., v1.0.5+)
3. `latest.json` must be accessible at the endpoint

### Steps:

1. **Build older version:**
   ```bash
   # Temporarily change version in:
   # - tauri.conf.json (line 4): "version": "1.0.4"
   # - src/hooks/useAutoUpdate.ts (line 9): const CURRENT_VERSION = '1.0.4';
   
   npm run tauri:build
   ```

2. **Install the built version** (not dev mode)

3. **Open the installed app**

4. **Update dialog should appear automatically** (after 3 seconds)

5. **Open console** (if DevTools enabled) or check logs

6. **Click "Install now"**

7. **Verify:**
   - Console shows `isStored: true`
   - Installation completes
   - App restarts automatically
   - New version loads

## 🔍 Debugging Tips

### If you don't see `isStored: true`:
- The update object might not be stored correctly
- Check if `setTauriUpdate(update)` is being called in `checkForUpdates`

### If you see "No stored update object, checking again...":
- This means the stored object wasn't available
- This is a fallback, but ideally shouldn't happen
- Check if update check ran before clicking install

### If installation fails:
- Check console for error details
- Verify `update.install` is a function
- Check if you have write permissions
- Verify antivirus isn't blocking

### To reset and test again:
```javascript
// In browser console:
localStorage.removeItem('acceptedUpdate');
localStorage.removeItem('dismissedUpdate');
// Then restart app or click "Check for Updates"
```

## ✅ Success Criteria

The fix is working if:
1. ✅ Update object is stored when update is found
2. ✅ Stored object is used when clicking "Install now" (not calling check() again)
3. ✅ Console shows `isStored: true`
4. ✅ Installation function is called successfully
5. ✅ App restarts with new version (in production build)

## 📝 What Changed

**Before:** Called `check()` again in `downloadAndInstall`, which might not work correctly.

**After:** Stores the update object when first checking, then reuses it for installation.

**Key Code:**
- Added: `const [tauriUpdate, setTauriUpdate] = useState<any>(null);`
- Stores: `setTauriUpdate(update)` when update is found
- Reuses: `let update = tauriUpdate;` in `downloadAndInstall`
