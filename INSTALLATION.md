# BetSure Dialer - Installation Guide

This guide covers installation and setup for the BetSure Dialer desktop application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Database Configuration](#database-configuration)
4. [Building the Windows Installer](#building-the-windows-installer)
5. [Distribution](#distribution)

## Prerequisites

### For Development

- **Node.js** 18+ and npm
- **Rust** (for desktop builds) - [Install Rust](https://rustup.rs/)
- **Git** for cloning the repository

### For Building Windows Installer

- **Rust** with Windows toolchain
- **NSIS** (Nullsoft Scriptable Install System) - Required for Windows installer
  - Download from: https://nsis.sourceforge.io/Download
  - Add NSIS to your PATH environment variable

## Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/Visionatedigital/bet-wise-dialer.git
cd bet-wise-dialer
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory. See [Database Configuration](#database-configuration) below.

### 3. Run Development Server

```bash
# Web development server
npm run dev

# Desktop app in development mode
npm run tauri:dev
```

## Database Configuration

The application supports three database modes:

### Mode 1: Supabase Cloud (Default)

Use Supabase Cloud for production or development.

**Setup:**
1. Create a `.env` file with:
```env
VITE_DATABASE_MODE=supabase-cloud
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Or use the helper script:
```bash
npm run use:cloud
```

### Mode 2: Local Supabase

Use local Supabase instance for development.

**Setup:**
1. Install Supabase CLI: https://supabase.com/docs/guides/cli
2. Start local Supabase:
```bash
npm run supabase:setup
```

3. Switch to local mode:
```bash
npm run use:local
```

### Mode 3: Custom Server (Company-hosted PostgreSQL)

Use your company's PostgreSQL server via PostgREST API.

**Prerequisites:**
- PostgreSQL database server
- PostgREST API server configured
- Database schema matching Supabase structure

**Setup:**

**On Windows (PowerShell):**
```powershell
.\scripts\use-custom-server.ps1
```

**On Linux/Mac (Bash):**
```bash
chmod +x scripts/use-custom-server.sh
./scripts/use-custom-server.sh
```

**Manual Setup:**
Create a `.env` file with:
```env
VITE_DATABASE_MODE=custom-server
VITE_CUSTOM_DB_URL=http://your-server:3000
VITE_CUSTOM_DB_KEY=your-postgrest-anon-key
VITE_CUSTOM_DB_SCHEMA=public
```

**Important Notes:**
- Your PostgREST server must expose the same API structure as Supabase
- Ensure Row Level Security (RLS) policies are configured if needed
- The database schema should match the Supabase schema structure
- Authentication may need custom implementation if not using Supabase Auth

## Building the Windows Installer

### Step 1: Install NSIS

1. Download NSIS from https://nsis.sourceforge.io/Download
2. Install NSIS (default location: `C:\Program Files (x86)\NSIS`)
3. Add NSIS to your PATH:
   - Add `C:\Program Files (x86)\NSIS` to your system PATH
   - Or use: `setx PATH "%PATH%;C:\Program Files (x86)\NSIS"`

### Step 2: Build the Application

```bash
# Build the frontend
npm run build

# Build the Windows installer
npm run tauri:build
```

The installer will be created at:
```
src-tauri/target/release/bundle/nsis/BetSure Dialer_1.0.0_x64-setup.exe
```

### Step 3: Customize Installer (Optional)

Edit `src-tauri/tauri.conf.json` to customize:
- Installer icon
- Shortcut names
- Installation directory options
- Uninstaller settings

Current installer features:
- ✅ Per-machine installation (requires admin)
- ✅ Start menu folder grouping
- ✅ LZMA compression for smaller installer size
- ✅ Uninstaller included (default NSIS behavior)

## Distribution

### Windows Installer

The NSIS installer (`BetSure Dialer_1.0.0_x64-setup.exe`) can be distributed to end users.

**Installation Process:**
1. User runs the installer
2. Chooses installation directory (optional)
3. Selects shortcuts to create
4. Application installs to Program Files
5. Shortcuts created on desktop and Start Menu

**Uninstallation:**
- Via Windows Settings > Apps
- Via Start Menu > BetSure Dialer > Uninstall

### Code Signing (Optional)

For production distribution, consider code signing:

1. Obtain a code signing certificate
2. Update `tauri.conf.json`:
```json
"windows": {
  "certificateThumbprint": "your-certificate-thumbprint"
}
```

3. Rebuild the installer

## Troubleshooting

### NSIS Not Found

**Error:** `'makensis' is not recognized as an internal or external command`

**Solution:**
- Ensure NSIS is installed
- Add NSIS to your PATH environment variable
- Restart your terminal/IDE

### Build Fails

**Error:** Rust compilation errors

**Solution:**
- Ensure Rust is installed: `rustc --version`
- Update Rust: `rustup update`
- Clean build: `cd src-tauri && cargo clean && cd ..`

### Database Connection Issues

**Error:** Cannot connect to database

**Solution:**
- Verify `.env` file exists and has correct values
- Check database server is running
- Verify network connectivity
- Check firewall settings for custom server mode

## Next Steps

- See [README.md](./README.md) for application usage
- See [BACKEND_DOCUMENTATION.md](./BACKEND_DOCUMENTATION.md) for backend details
- Check documentation folder for role-specific workflows

