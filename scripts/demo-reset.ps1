#Requires -Version 7.0
<#
.SYNOPSIS
    PlantMoji demo reset — wipes game progress for one plant (filming retakes).

.DESCRIPTION
    Calls POST /api/demo-reset on a running dev server so the KBS documentary
    filming scenario can be re-shot from a clean baseline without hand-editing
    the database.

    Cleared for the plant: quests, xp_rewards, bond_events, plant_badges and
    device_events rows; bond_state is reset to Lv.1 / 0 XP / no streak /
    chapter 1, and the plant returns to Happy with an epoch state_changed_at.

    NOT cleared: growth_records (real-world growth log) and sensor_readings
    (Node-RED's table).

    The endpoint is destructive, so it only works when the server has
    DEVICE_API_TOKEN set in .env.local — and this script must send the same
    value via -Token. Without the env var the server answers 403.

.PARAMETER BaseUrl
    Dev server base URL. Default: http://localhost:3000

.PARAMETER PlantId
    Plant to reset. Default: plant-01

.PARAMETER Token
    The server's DEVICE_API_TOKEN value. Required.

.PARAMETER Force
    Skip the confirmation prompt (for scripted retakes between takes).

.EXAMPLE
    pwsh -File scripts/demo-reset.ps1 -Token my-secret-token

.EXAMPLE
    pwsh -File scripts/demo-reset.ps1 -Token my-secret-token -PlantId plant-01 -Force
#>
[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$PlantId = "plant-01",
    [Parameter(Mandatory)][string]$Token,
    [switch]$Force
)

if (-not $Force) {
    $answer = Read-Host ("This wipes game progress for {0}. Continue? y/N" -f $PlantId)
    if ($answer -ne "y" -and $answer -ne "Y") {
        Write-Host "Aborted - nothing was changed." -ForegroundColor Yellow
        exit 1
    }
}

$body = @{ plantId = $PlantId } | ConvertTo-Json
$headers = @{ Authorization = "Bearer $Token" }

try {
    $statusCode = 0
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/demo-reset" -Method Post -ContentType "application/json" `
        -Body $body -Headers $headers -SkipHttpErrorCheck -StatusCodeVariable statusCode -ErrorAction Stop
}
catch {
    Write-Host ("ERROR: could not reach the server: {0}" -f $_.Exception.Message) -ForegroundColor Red
    Write-Host "Is the dev server running at $BaseUrl (npm run dev)?" -ForegroundColor Yellow
    exit 1
}

if ($statusCode -ne 200 -or $resp.ok -ne $true) {
    $respText = if ($null -ne $resp) { $resp | ConvertTo-Json -Compress -Depth 5 } else { "<empty body>" }
    Write-Host ("ERROR: reset failed (HTTP {0}): {1}" -f $statusCode, $respText) -ForegroundColor Red
    if ($statusCode -eq 403) {
        Write-Host "The server has no DEVICE_API_TOKEN - add it to .env.local and restart the dev server." -ForegroundColor Yellow
    }
    elseif ($statusCode -eq 401) {
        Write-Host "Token mismatch - pass the exact value of the server's DEVICE_API_TOKEN." -ForegroundColor Yellow
    }
    exit 1
}

Write-Host ("Reset OK for {0}." -f $resp.plantId) -ForegroundColor Green
Write-Host "Rows cleared:"
foreach ($prop in $resp.cleared.PSObject.Properties) {
    Write-Host ("  {0,-15} {1}" -f $prop.Name, $prop.Value)
}
Write-Host "bond_state -> Lv.1 / 0 XP / streak 0 / chapter 1; plant is Happy again." -ForegroundColor Green
Write-Host "Not touched: growth_records, sensor_readings." -ForegroundColor DarkGray
exit 0
