# Release v1.0.4

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
- **Use Case**: Create admin users directly in Supabase without logging in

## 🔧 Technical Improvements

- Removed all mock data dependencies
- Improved database query performance for lead filtering
- Enhanced error handling in authentication flow
- Added diagnostic queries for lead assignment verification

## 📦 Installation

Download the installer: `BetSure Dialer_1.0.4_x64-setup.exe`

## ⚠️ Important Notes

- **Database Migration Required**: Run `20250123000000_fix_agent_leads_filtering.sql` in Supabase if not already done
- **Agent Refresh**: Agents should refresh their dashboards to see the correct lead counts
- **Version Check**: The app will automatically check for updates and notify users

## 🔄 Migration Steps

1. Run the database migration in Supabase SQL Editor
2. Deploy the updated frontend build
3. Distribute the new installer to users
4. Users will be notified of the update automatically


