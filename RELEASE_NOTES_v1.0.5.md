# Release Notes v1.0.5

## 🐛 Bug Fixes

### Critical: Call Activities Data Display
- **Fixed**: Recent Call Activities table was showing incorrect data:
  - Lead names showing as "Unknown" instead of actual lead names
  - Phone numbers showing as "N/A" instead of actual numbers
  - Durations showing as "0:00" even for completed calls
  - Notes containing session IDs (e.g., "session:ATVId_...") instead of clean notes
  - Campaign names not properly displayed
- **Solution**: 
  - Enhanced data fetching to join with `leads` table for real lead names and phone numbers
  - Calculate duration from `start_time` and `end_time` when `duration_seconds` is missing
  - Clean notes to remove session IDs and technical artifacts
  - Improved campaign name resolution from both call activities and leads
  - Use `start_time` instead of `created_at` for accurate call timestamps
- **Impact**: Call activities now display accurate, real data from the database

### Critical: Sign Out Issue Fixed
- **Fixed**: Users (especially agents) were unable to sign out - clicking "Sign out" would redirect them back to the dashboard
- **Root Cause**: Race condition where auth state wasn't cleared before redirect, causing Auth page to see user as still logged in
- **Solution**: 
  - Manually clear user/session state immediately on sign out
  - Added `signingOut` flag to prevent redirect loops
  - Improved auth state synchronization
  - Added stricter checks in Auth page before redirecting
- **Impact**: All users can now successfully sign out without being redirected back to dashboard

### Supabase Rate Limit Handling
- **Fixed**: "Request rate limit reached" errors were showing generic messages
- **Solution**: 
  - Enhanced rate limit detection for Supabase-specific error codes (PGRST116, PGRST301)
  - Improved error message parsing from Supabase error structure
  - Added user-friendly messages with retry time information
  - Integrated rate limit handling in RecentCallActivities component
- **Impact**: Users now see clear, actionable messages when rate limits are hit

### Auto-Updater Improvements
- **Fixed**: Auto-updater now automatically installs updates when users click "Install now"
- **Fixed**: Simplified update dialog - removed verbose "What's new" section for cleaner UI
- **Previous**: Only opened download page, requiring manual installation
- **Now**: Automatically downloads, installs, and restarts the app

## ✨ UI Improvements

### Management Dashboard Updates
- **Changed**: Management Dashboard title updated to "Manager Hub"
- **Added**: Subtitle now shows "Management Dashboard • Performance analytics and agent insights"
- **Fixed**: Email domains are now hidden in the UI for internal system security
  - User dropdown shows only username (e.g., "john.doe" instead of "john.doe@betsurecrm.com")
  - Username is properly formatted with capitalization

## 🔧 Technical Improvements

- Enhanced data fetching with proper table joins for call activities
- Improved duration calculation from timestamps
- Better error handling for Supabase rate limits
- Enhanced sign-out flow with proper state management
- Improved race condition handling in authentication
- Better session storage cleanup on logout
- More reliable auth state synchronization
- Added rate limit detection utility functions
- Cleaner update dialog interface

## 📦 Installation

Download the installer: `BetSure Dialer_1.0.5_x64-setup.exe`

## ⚠️ Important Notes

- **All Users**: This update fixes critical data display issues and sign-out problems
- **Agents**: Call activities now show accurate lead information and call details
- **Managers/Admins**: 
  - Recent Call Activities table now displays real data for better reporting
  - Management Dashboard rebranded to "Manager Hub"
  - Email domains hidden for internal system security
- **Rate Limits**: Better error messages when Supabase rate limits are encountered
- **Auto-Updates**: Users on previous versions will be notified of this update automatically

## 🔄 Migration Steps

1. Users will be automatically notified of the update
2. Click "Install now" to automatically download and install
3. The app will restart with the new version
4. Call activities will now display accurate data
5. Sign out functionality will work correctly
6. Management Dashboard now shows as "Manager Hub"
