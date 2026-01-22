# PowerShell script to create GitHub release v1.0.4
# Requires: GitHub Personal Access Token with repo permissions

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken
)

$repo = "Visionatedigital/bet-wise-dialer"
$tag = "v1.0.4"
$releaseName = "v1.0.4 - Agent Lead Filtering Fix"
$installerPath = "src-tauri\target\release\bundle\nsis\BetSure Dialer_1.0.4_x64-setup.exe"
$latestJsonPath = "src-tauri\target\release\bundle\latest.json"
$releaseNotesPath = "RELEASE_NOTES_v1.0.4.md"

# Read release notes
$releaseNotes = Get-Content $releaseNotesPath -Raw

# Create release body (first 500 chars of release notes)
$releaseBody = $releaseNotes

Write-Host "Creating GitHub release: $tag" -ForegroundColor Green

# Create the release
$releaseData = @{
    tag_name = $tag
    name = $releaseName
    body = $releaseBody
    draft = $false
    prerelease = $false
} | ConvertTo-Json

$headers = @{
    "Authorization" = "token $GitHubToken"
    "Accept" = "application/vnd.github.v3+json"
}

try {
    $releaseResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" `
        -Method Post `
        -Headers $headers `
        -Body $releaseData `
        -ContentType "application/json"
    
    $releaseId = $releaseResponse.id
    Write-Host "Release created successfully! ID: $releaseId" -ForegroundColor Green
    
    # Upload installer
    if (Test-Path $installerPath) {
        Write-Host "Uploading installer..." -ForegroundColor Yellow
        $installerName = "BetSure.Dialer_1.0.4_x64-setup.exe"
        $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$releaseId/assets?name=$installerName"
        
        $fileBytes = [System.IO.File]::ReadAllBytes($installerPath)
        $fileEnc = [System.Text.Encoding]::GetEncoding("ISO-8859-1").GetString($fileBytes)
        
        $uploadHeaders = @{
            "Authorization" = "token $GitHubToken"
            "Accept" = "application/vnd.github.v3+json"
            "Content-Type" = "application/octet-stream"
        }
        
        $uploadResponse = Invoke-RestMethod -Uri $uploadUrl `
            -Method Post `
            -Headers $uploadHeaders `
            -Body ([System.Text.Encoding]::GetEncoding("ISO-8859-1").GetBytes($fileEnc))
        
        Write-Host "Installer uploaded successfully!" -ForegroundColor Green
    } else {
        Write-Host "Warning: Installer not found at $installerPath" -ForegroundColor Yellow
    }
    
    # Upload latest.json
    if (Test-Path $latestJsonPath) {
        Write-Host "Uploading latest.json..." -ForegroundColor Yellow
        $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$releaseId/assets?name=latest.json"
        
        $fileContent = Get-Content $latestJsonPath -Raw
        $fileBytes = [System.Text.Encoding]::UTF8.GetBytes($fileContent)
        
        $uploadHeaders = @{
            "Authorization" = "token $GitHubToken"
            "Accept" = "application/vnd.github.v3+json"
            "Content-Type" = "application/json"
        }
        
        $uploadResponse = Invoke-RestMethod -Uri $uploadUrl `
            -Method Post `
            -Headers $uploadHeaders `
            -Body $fileBytes
        
        Write-Host "latest.json uploaded successfully!" -ForegroundColor Green
    } else {
        Write-Host "Warning: latest.json not found at $latestJsonPath" -ForegroundColor Yellow
    }
    
    Write-Host "`nRelease created successfully!" -ForegroundColor Green
    Write-Host "Release URL: $($releaseResponse.html_url)" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error creating release: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

