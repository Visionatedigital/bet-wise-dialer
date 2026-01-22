# Create GitHub Release v1.0.4

## Option 1: Using PowerShell Script (Recommended)

1. **Get a GitHub Personal Access Token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Name it: "Release Token"
   - Select scope: `repo` (full control of private repositories)
   - Click "Generate token"
   - **Copy the token** (you won't see it again!)

2. **Run the PowerShell script:**
   ```powershell
   cd bet-wise-dialer
   .\create_release.ps1 -GitHubToken "your_token_here"
   ```

## Option 2: Using GitHub CLI (if installed)

1. **Install GitHub CLI:**
   - Download from: https://cli.github.com/
   - Or use: `winget install GitHub.cli`

2. **Authenticate:**
   ```bash
   gh auth login
   ```

3. **Create the release:**
   ```bash
   cd bet-wise-dialer
   gh release create v1.0.4 `
     --title "v1.0.4 - Agent Lead Filtering Fix" `
     --notes-file RELEASE_NOTES_v1.0.4.md `
     "src-tauri/target/release/bundle/nsis/BetSure Dialer_1.0.4_x64-setup.exe#BetSure.Dialer_1.0.4_x64-setup.exe" `
     "src-tauri/target/release/bundle/latest.json"
   ```

## Option 3: Manual via GitHub Web Interface

1. Go to: https://github.com/Visionatedigital/bet-wise-dialer/releases/new
2. Tag: `v1.0.4`
3. Title: `v1.0.4 - Agent Lead Filtering Fix`
4. Description: Copy from `RELEASE_NOTES_v1.0.4.md`
5. Upload files:
   - `src-tauri/target/release/bundle/nsis/BetSure Dialer_1.0.4_x64-setup.exe` (rename to `BetSure.Dialer_1.0.4_x64-setup.exe`)
   - `src-tauri/target/release/bundle/latest.json`
6. Click "Publish release"

