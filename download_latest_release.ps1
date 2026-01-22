# Script to download the latest GitHub release using GitHub CLI
# Prerequisites: GitHub CLI must be installed and authenticated

param(
    [string]$OutputDir = "downloads",
    [switch]$DownloadAll = $false
)

$repo = "Visionatedigital/bet-wise-dialer"

Write-Host "Downloading latest release from $repo..." -ForegroundColor Green

# Check if gh is installed
try {
    $ghVersion = gh --version
    Write-Host "GitHub CLI found: $($ghVersion -split "`n" | Select-Object -First 1)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: GitHub CLI (gh) is not installed!" -ForegroundColor Red
    Write-Host "Please install it from: https://github.com/cli/cli/releases/latest" -ForegroundColor Yellow
    exit 1
}

# Check authentication
try {
    gh auth status | Out-Null
    Write-Host "GitHub CLI authenticated" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Not authenticated with GitHub CLI!" -ForegroundColor Red
    Write-Host "Run: gh auth login" -ForegroundColor Yellow
    exit 1
}

# Create output directory if it doesn't exist
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Host "Created output directory: $OutputDir" -ForegroundColor Cyan
}

# Get latest release info
Write-Host "`nFetching latest release information..." -ForegroundColor Yellow
try {
    $release = gh release view latest --repo $repo --json tagName,name,body,assets,createdAt
    $releaseJson = $release | ConvertFrom-Json
    
    Write-Host "Latest Release: $($releaseJson.tagName)" -ForegroundColor Green
    Write-Host "Name: $($releaseJson.name)" -ForegroundColor Cyan
    Write-Host "Created: $($releaseJson.createdAt)" -ForegroundColor Cyan
    Write-Host "Assets: $($releaseJson.assets.Count)" -ForegroundColor Cyan
    
    if ($releaseJson.assets.Count -eq 0) {
        Write-Host "No assets found in this release." -ForegroundColor Yellow
        exit 0
    }
    
    # Show available assets
    Write-Host "`nAvailable assets:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $releaseJson.assets.Count; $i++) {
        $asset = $releaseJson.assets[$i]
        Write-Host "  [$i] $($asset.name) ($([math]::Round($asset.size / 1MB, 2)) MB)" -ForegroundColor White
    }
    
    if ($DownloadAll) {
        # Download all assets
        Write-Host "`nDownloading all assets..." -ForegroundColor Yellow
        foreach ($asset in $releaseJson.assets) {
            $outputPath = Join-Path $OutputDir $asset.name
            Write-Host "  Downloading: $($asset.name)..." -ForegroundColor Cyan
            gh release download $releaseJson.tagName --repo $repo --pattern $asset.name --dir $OutputDir
            Write-Host "    Saved to: $outputPath" -ForegroundColor Green
        }
    } else {
        # Download specific files (installer and latest.json)
        Write-Host "`nDownloading installer and latest.json..." -ForegroundColor Yellow
        
        # Find installer (.exe file)
        $installer = $releaseJson.assets | Where-Object { $_.name -like "*.exe" } | Select-Object -First 1
        if ($installer) {
            Write-Host "  Downloading installer: $($installer.name)..." -ForegroundColor Cyan
            gh release download $releaseJson.tagName --repo $repo --pattern $installer.name --dir $OutputDir
            Write-Host "    Saved to: $(Join-Path $OutputDir $installer.name)" -ForegroundColor Green
        } else {
            Write-Host "  Warning: No installer (.exe) found in release" -ForegroundColor Yellow
        }
        
        # Find latest.json
        $latestJson = $releaseJson.assets | Where-Object { $_.name -eq "latest.json" } | Select-Object -First 1
        if ($latestJson) {
            Write-Host "  Downloading latest.json..." -ForegroundColor Cyan
            gh release download $releaseJson.tagName --repo $repo --pattern "latest.json" --dir $OutputDir
            Write-Host "    Saved to: $(Join-Path $OutputDir 'latest.json')" -ForegroundColor Green
        } else {
            Write-Host "  Warning: latest.json not found in release" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`nDownload complete!" -ForegroundColor Green
    Write-Host "Files saved to: $((Resolve-Path $OutputDir).Path)" -ForegroundColor Cyan
    
} catch {
    Write-Host "ERROR: Failed to download release: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

