# Installing Rust on Windows

Rust is required to build the Tauri desktop application. Follow these steps to install it:

## Method 1: Using the Official Installer (Recommended)

1. **Download rustup-init.exe:**
   - Visit: https://rustup.rs/
   - Click "Download rustup-init.exe" for Windows
   - Or direct link: https://win.rustup.rs/x86_64

2. **Run the installer:**
   - Double-click `rustup-init.exe`
   - Press Enter to proceed with default installation
   - Wait for installation to complete

3. **Restart your terminal:**
   - Close and reopen PowerShell/Command Prompt
   - Or restart your IDE/editor

4. **Verify installation:**
   ```powershell
   rustc --version
   cargo --version
   ```

## Method 2: Using Chocolatey (If installed)

If you have Chocolatey package manager installed:

```powershell
choco install rust
```

## Method 3: Manual Download

1. Download rustup-init.exe from https://rustup.rs/
2. Run it in PowerShell:
   ```powershell
   .\rustup-init.exe
   ```
3. Follow the prompts (default options are fine)

## After Installation

Once Rust is installed, you can build the Windows installer:

```powershell
cd bet-wise-dialer
npm run tauri:build
```

## Troubleshooting

### "rustc is not recognized"
- **Solution:** Restart your terminal/IDE after installation
- **Alternative:** Add Rust to PATH manually:
  - Add `C:\Users\<YourUsername>\.cargo\bin` to your PATH
  - Restart terminal

### Installation fails
- Ensure you have internet connection
- Run PowerShell as Administrator
- Check Windows Defender/firewall settings

### Need Visual Studio Build Tools
Rust on Windows requires Microsoft C++ Build Tools:
- Download from: https://visualstudio.microsoft.com/downloads/
- Install "Desktop development with C++" workload
- Or install "Build Tools for Visual Studio"

## Next Steps

After Rust is installed:
1. Verify: `rustc --version` and `cargo --version`
2. Build the installer: `npm run tauri:build`
3. Find installer at: `src-tauri/target/release/bundle/nsis/BetSure Dialer_1.0.0_x64-setup.exe`

