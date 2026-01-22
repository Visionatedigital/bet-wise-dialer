# Install GitHub CLI on Windows

## Quick Install Options

### Option 1: Direct Download (Easiest)
1. Download from: https://github.com/cli/cli/releases/latest
2. Download: `gh_X.X.X_windows_amd64.msi`
3. Run the installer
4. Restart PowerShell/Terminal
5. Verify: `gh --version`

### Option 2: Using Scoop (if you have it)
```powershell
scoop install gh
```

### Option 3: Using Chocolatey (if you have it)
```powershell
choco install gh
```

## After Installation

1. **Authenticate:**
   ```powershell
   gh auth login
   ```
   - Choose: GitHub.com
   - Choose: HTTPS
   - Authenticate via browser

2. **Verify:**
   ```powershell
   gh auth status
   ```

