# How to Delete WhatsApp Data on Windows

## Method 1: WhatsApp Desktop App (If Installed)

### Uninstall WhatsApp Desktop
1. Open **Settings** → **Apps** → **Apps & features**
2. Search for "WhatsApp"
3. Click on WhatsApp
4. Click **Uninstall**
5. This will remove the app and its data

### Manual Data Deletion
If you want to keep WhatsApp but delete data:

**Location 1: Local AppData**
```
C:\Users\<YourUsername>\AppData\Local\WhatsApp
```

**Location 2: Roaming AppData**
```
C:\Users\<YourUsername>\AppData\Roaming\WhatsApp
```

**To delete:**
1. Press `Win + R`
2. Type: `%LOCALAPPDATA%\WhatsApp` and press Enter
3. Delete all contents
4. Repeat for: `%APPDATA%\WhatsApp`

## Method 2: WhatsApp from Microsoft Store

**Location:**
```
C:\Users\<YourUsername>\AppData\Local\Packages\5319275A.WhatsAppDesktop_*
```

**To delete:**
1. Open **Settings** → **Apps**
2. Find "WhatsApp"
3. Click **Advanced options**
4. Click **Reset** (deletes all data)
5. Or **Uninstall** to remove completely

## Method 3: WhatsApp Media Files

Check these locations for media files:

**Downloads Folder:**
```
C:\Users\<YourUsername>\Downloads\WhatsApp*
```

**Documents:**
```
C:\Users\<YourUsername>\Documents\WhatsApp*
```

**Pictures:**
```
C:\Users\<YourUsername>\Pictures\WhatsApp*
```

## PowerShell Cleanup Script

Run this to find and delete WhatsApp data:

```powershell
# Check sizes first
$paths = @(
    "$env:LOCALAPPDATA\WhatsApp",
    "$env:APPDATA\WhatsApp",
    "$env:USERPROFILE\Downloads\WhatsApp*",
    "$env:USERPROFILE\Documents\WhatsApp*"
)

foreach ($path in $paths) {
    if (Test-Path $path) {
        $size = (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB
        Write-Host "$path : $([math]::Round($size, 2)) GB"
    }
}

# Delete (uncomment to actually delete)
# Remove-Item "$env:LOCALAPPDATA\WhatsApp" -Recurse -Force -ErrorAction SilentlyContinue
# Remove-Item "$env:APPDATA\WhatsApp" -Recurse -Force -ErrorAction SilentlyContinue
```

## Important Notes

⚠️ **Warning:** Deleting WhatsApp data will:
- Remove all chat history
- Remove all media files
- Remove all backups
- You'll need to set up WhatsApp again

✅ **Before deleting:**
- Backup important chats (if needed)
- Save important media files
- Export contacts if needed

## After Deletion

Check your free space:
```powershell
Get-PSDrive C | Format-Table Name,@{Name="Free(GB)";Expression={[math]::Round($_.Free/1GB,2)}}
```

