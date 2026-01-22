# Create GitHub Release v1.0.4

## Steps to Create the Release

### 1. Go to GitHub Releases
Navigate to: https://github.com/Visionatedigital/bet-wise-dialer/releases/new

### 2. Fill in Release Details

**Tag version:** `v1.0.4`

**Release title:** `v1.0.4 - Agent Lead Filtering Fix`

**Description:** (Copy from RELEASE_NOTES_v1.0.4.md or use this):

```markdown
## 🐛 Bug Fixes

### Critical: Agent Lead Filtering
- **Fixed**: Agents were seeing all leads (921) instead of only their assigned leads (78-77)
- **Solution**: Updated `get_agent_uncalled_leads` database function to strictly filter by `user_id`
- **Impact**: Agents now only see leads explicitly assigned to them by admins

### Password Reset Improvements
- **Fixed**: Password reset flow not properly updating passwords
- **Solution**: Enhanced session detection and recovery token handling
- **Added**: Better error messages and validation

## ✨ New Features

### Admin User Management
- **Added**: Scripts and documentation for manually creating admin users
- **Files**: `CREATE_ADMIN_USER.md`, `create_admin_shammah.sql`, `set_admin_role.sql`

## 🔧 Technical Improvements

- Removed all mock data dependencies
- Improved database query performance for lead filtering
- Enhanced error handling in authentication flow
- Added diagnostic queries for lead assignment verification

## ⚠️ Important Notes

- **Database Migration Required**: Run `20250123000000_fix_agent_leads_filtering.sql` in Supabase if not already done
- **Agent Refresh**: Agents should refresh their dashboards to see the correct lead counts
```

### 3. Upload the Installer

**Drag and drop or browse to upload:**
```
src-tauri/target/release/bundle/nsis/BetSure Dialer_1.0.4_x64-setup.exe
```

**Rename the file in GitHub to:** `BetSure.Dialer_1.0.4_x64-setup.exe`
(This matches the URL in latest.json)

### 4. Upload latest.json

**Drag and drop or browse to upload:**
```
src-tauri/target/release/bundle/latest.json
```

### 5. Publish Release

- Check "Set as the latest release" (if this is the latest)
- Click "Publish release"

## After Publishing

The app's auto-updater will:
1. Detect the new version (1.0.4 > 1.0.3)
2. Notify users that an update is available
3. Allow them to download and install the new version

## Verification

After publishing, verify the release:
- Check that the installer downloads correctly
- Verify `latest.json` is accessible at: https://github.com/Visionatedigital/bet-wise-dialer/releases/latest/download/latest.json
- Test the auto-update notification in the app

