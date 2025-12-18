# Adding Rust to System PATH (Windows)

## Quick Method (Already Done)

Rust has been added to your User PATH environment variable. The path added is:
```
C:\Users\LUBS\.cargo\bin
```

## Verify It's Working

In your current terminal, Rust should now work:
```powershell
rustc --version
cargo --version
```

## For New Terminal Windows

**Important:** After adding to PATH, you need to:
1. **Close and reopen** any existing terminal windows
2. **Restart your IDE/editor** (VS Code, Cursor, etc.)
3. New terminal windows will automatically have Rust in PATH

## Manual Method (If Needed)

If you need to add it manually or verify:

### Method 1: Using PowerShell (Run as Administrator)
```powershell
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\Users\LUBS\.cargo\bin",
    "User"
)
```

### Method 2: Using System Properties GUI
1. Press `Win + X` and select "System"
2. Click "Advanced system settings"
3. Click "Environment Variables"
4. Under "User variables", find "Path" and click "Edit"
5. Click "New" and add: `C:\Users\LUBS\.cargo\bin`
6. Click "OK" on all dialogs
7. Restart your terminal/IDE

## Verify PATH is Set

Check if Rust is in your PATH:
```powershell
$env:Path -split ';' | Select-String -Pattern 'cargo'
```

You should see: `C:\Users\LUBS\.cargo\bin`

## Test Installation

After restarting your terminal:
```powershell
rustc --version
cargo --version
```

Both commands should work without errors.

## Next Steps

Once Rust is in PATH:
1. Restart your terminal/IDE
2. Navigate to project: `cd bet-wise-dialer`
3. Build the installer: `npm run tauri:build`

