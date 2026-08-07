#Requires -Version 7.0
<#
.SYNOPSIS
    LeafTalk final demo rehearsal (handoff Phase 20 filming scenario).

.DESCRIPTION
    Automates the on-camera vertical demo against a running dev server
    (npm run dev), narrating each step and waiting where the real demo waits:

      Baseline   Jamkachu - Happy, Bond Lv.2 - 70 XP
      Scene 1    Overheating event (34.2 C) -> web shows Jamkachu on fire + NEW QUEST
                 "Cool Me Down" (base reward +30 XP)
      Scene 2    Recovery event (29 C, back to Happy) -> quest enters a
                 5-minute VERIFYING window (COOL_ME_DOWN requiredSeconds = 300)
      Scene 3    POST /api/game-tick polled every 30 s (up to 6 minutes) so the
                 time-window completion lands promptly: Quest Complete, base +30 XP
                 -- during an active seasonal event the actual award is base x
                 multiplier (src/game/seasonal/seasonal-events.ts), e.g. August's
                 Hot Weather Challenge x1.2 -> 36 XP; 70 + 30 = 100 or
                 70 + 36 = 106 either way -> LEVEL UP -> Bond Lv.3

    Events are built to satisfy parseDeviceEvent exactly: unique eventId,
    type PLANT_STATE_CHANGED, occurredAt from (Get-Date).ToString("o") (ISO
    8601 with local timezone offset, never in the future), and a valid
    data.currentState mood.

.PARAMETER FastForward
    Dry run: sends nothing, waits for nothing — each step only prints what
    would happen (including the exact JSON payloads). Use it to rehearse the
    script itself before the filming rehearsal.

.EXAMPLE
    pwsh -File scripts/demo-rehearsal.ps1

.EXAMPLE
    pwsh -File scripts/demo-rehearsal.ps1 -FastForward
#>
[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$PlantId = "plant-01",
    # Optional shared token; needed only if the server has DEVICE_API_TOKEN set.
    [string]$Token,
    [switch]$FastForward
)

function Write-Step {
    param([Parameter(Mandatory)][string]$Title)
    Write-Host ""
    Write-Host ("==== {0} ====" -f $Title) -ForegroundColor Cyan
}

function Write-Note {
    param([Parameter(Mandatory)][string]$Text)
    Write-Host ("  NOTE: {0}" -f $Text) -ForegroundColor Yellow
}

function Wait-Operator {
    param([Parameter(Mandatory)][string]$Prompt)
    if ($FastForward) {
        Write-Host ("  [DRY RUN] would pause here for the operator: {0}" -f $Prompt) -ForegroundColor DarkGray
        return
    }
    Read-Host ("  >> {0} — press Enter to continue" -f $Prompt) | Out-Null
}

# Builds and sends one PLANT_STATE_CHANGED event that parseDeviceEvent accepts
# verbatim. Returns $true when the demo can continue.
function Send-DemoEvent {
    param(
        [Parameter(Mandatory)][string]$LabelSlug,
        [Parameter(Mandatory)][hashtable]$Data
    )
    $payload = [ordered]@{
        eventId    = "evt-demo-$PlantId-$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())-$LabelSlug"
        plantId    = $PlantId
        type       = "PLANT_STATE_CHANGED"
        occurredAt = (Get-Date).ToString("o")
        data       = $Data
    }
    $json = $payload | ConvertTo-Json -Depth 5

    if ($FastForward) {
        Write-Host ("  [DRY RUN] would POST {0}/api/device-events with:" -f $BaseUrl) -ForegroundColor DarkGray
        Write-Host $json -ForegroundColor DarkGray
        return $true
    }

    $headers = @{}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    try {
        $statusCode = 0
        $resp = Invoke-RestMethod -Uri "$BaseUrl/api/device-events" -Method Post -ContentType "application/json" `
            -Body $json -Headers $headers -SkipHttpErrorCheck -StatusCodeVariable statusCode -ErrorAction Stop
    }
    catch {
        Write-Host ("  ERROR: could not reach the server: {0}" -f $_.Exception.Message) -ForegroundColor Red
        return $false
    }
    if ($statusCode -ne 200 -or $resp.ok -ne $true) {
        $respText = if ($null -ne $resp) { $resp | ConvertTo-Json -Compress -Depth 5 } else { "<empty body>" }
        Write-Host ("  ERROR: server rejected the event (HTTP {0}): {1}" -f $statusCode, $respText) -ForegroundColor Red
        return $false
    }
    if ($resp.duplicate -eq $true) {
        Write-Host "  WARNING: server flagged this eventId as duplicate — unexpected during a rehearsal." -ForegroundColor Yellow
    }
    if ($resp.applied -eq $false) {
        Write-Host "  WARNING: applied:false — the plant already has a newer state_changed_at. Check this PC's clock vs earlier events." -ForegroundColor Yellow
    }
    else {
        Write-Host ("  Sent OK ({0}) — the web page updates without a refresh." -f $payload.eventId) -ForegroundColor Green
    }
    return $true
}

function Invoke-GameTick {
    try {
        $statusCode = 0
        $null = Invoke-RestMethod -Uri "$BaseUrl/api/game-tick" -Method Post -ContentType "application/json" `
            -Body (@{ plantId = $PlantId } | ConvertTo-Json) -SkipHttpErrorCheck -StatusCodeVariable statusCode -ErrorAction Stop
        return ($statusCode -eq 200)
    }
    catch {
        return $false
    }
}

# ---------------------------------------------------------------------------
Write-Host "LeafTalk demo rehearsal — handoff Phase 20 filming scenario" -ForegroundColor Cyan
Write-Host ("Target: {0}  plant: {1}  mode: {2}" -f $BaseUrl, $PlantId, $(if ($FastForward) { "FAST-FORWARD (dry run, nothing is sent, no waiting)" } else { "LIVE" }))
Write-Host ""
Write-Host "Scenario baseline on camera: 'Plant Jamkachu - Happy / Bond Lv.2 - 70 XP'."
Write-Host "The quest's base reward is +30 XP. During an active seasonal event the actual"
Write-Host "award is base x multiplier (src/game/seasonal/seasonal-events.ts) -- in August"
Write-Host "the Hot Weather Challenge is x1.2, so the quest actually awards 36 XP. Either"
Write-Host "way XP crosses 100 (70 + 30 = 100, or 70 + 36 = 106 in August -> Bond Lv.3),"
Write-Host "so verify the XP counter on the web page before filming."
Write-Host "Keep a browser open at $BaseUrl next to this console for the whole run."

if (-not $FastForward) {
    # Preflight: /api/game-tick is unauthenticated and idempotent — a cheap way
    # to confirm the dev server and Supabase are up before touching the demo.
    $tickOk = Invoke-GameTick
    if (-not $tickOk) {
        Write-Host ""
        Write-Host "ABORT: $BaseUrl/api/game-tick did not answer 200. Start the dev server (npm run dev)" -ForegroundColor Red
        Write-Host "and check .env.local / Supabase, then run this rehearsal again." -ForegroundColor Red
        exit 1
    }
    Write-Host ""
    Write-Host "Preflight OK: dev server and game engine are answering." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
Write-Step "Step 1 / 4 — Happy baseline"
Write-Host "  Setting the on-camera starting point: Jamkachu is Happy."
if (-not (Send-DemoEvent -LabelSlug "baseline-happy" -Data @{ currentState = "Happy" })) { exit 1 }
Write-Note "Confirm on the web page: Jamkachu - Happy, and the XP counter you want on film (scenario assumes Bond Lv.2 - 70 XP)."
Wait-Operator "Baseline shot is framed and the camera is rolling"

# ---------------------------------------------------------------------------
Write-Step "Step 2 / 4 — Overheating (34.2 C)"
Write-Host "  In the real demo this is where the heat source raises the sensor to ~34 C:"
Write-Host "  the physical side reacts on its own (RGB -> Red, Servo -> Open, LCD 'Too Hot')."
if (-not (Send-DemoEvent -LabelSlug "overheating" -Data @{ previousState = "Happy"; currentState = "Overheating"; temperature = 34.2 })) { exit 1 }
Write-Note "watch the web page: Jamkachu turns 🔥 + Cool Me Down quest appears"
Write-Note "NEW QUEST 'Cool Me Down' — base reward +30 XP (higher during an active seasonal event, see the intro note). Film this beat before recovering."
Wait-Operator "Overheating scene is filmed, ready to start the recovery"

# ---------------------------------------------------------------------------
Write-Step "Step 3 / 4 — Recovery (29 C, back to Happy)"
Write-Host "  In the real demo this is the fan/ventilation cooling the plant back down."
$recoveryStart = Get-Date
if (-not (Send-DemoEvent -LabelSlug "recovery-happy" -Data @{ previousState = "Overheating"; currentState = "Happy"; temperature = 29.0 })) { exit 1 }
Write-Note "quest is VERIFYING for 5 minutes"
Write-Note "COOL_ME_DOWN requires 300 s of stability after leaving Overheating; a relapse into Overheating resets the quest, so keep the plant cool."

# ---------------------------------------------------------------------------
Write-Step "Step 4 / 4 — Verification window and quest completion"
if ($FastForward) {
    Write-Host "  [DRY RUN] would now poll POST $BaseUrl/api/game-tick every 30 s for up to 6 minutes:" -ForegroundColor DarkGray
    Write-Host "    - T+0:30 .. T+4:30 — each tick answers ok; the quest stays VERIFYING." -ForegroundColor DarkGray
    Write-Host "    - ~T+5:00 — the 300 s stability window ends; the next tick completes 'Cool Me Down'." -ForegroundColor DarkGray
    Write-Host "    - Operator cue at that moment: 'Quest Complete' on the web page -- base +30 XP," -ForegroundColor DarkGray
    Write-Host "      or base x seasonal multiplier if an event is active (August's Hot Weather" -ForegroundColor DarkGray
    Write-Host "      Challenge x1.2 -> 36 XP); 70 + 30 = 100 or 70 + 36 = 106 -> LEVEL UP overlay" -ForegroundColor DarkGray
    Write-Host "      -> Bond Lv.3 either way (physical celebration: RGB + buzzer + LCD)." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Dry run complete. Run without -FastForward against a live dev server for the real rehearsal." -ForegroundColor Green
    exit 0
}

Write-Host "  Polling POST /api/game-tick every 30 s (up to 6 minutes) so the time-window"
Write-Host "  completion lands promptly. The completion is computed from persisted"
Write-Host "  timestamps, so a tick right after T+5:00 settles it."

$deadline = $recoveryStart.AddSeconds(360)
$completed = $false
while (-not $completed -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 30
    $elapsed = [int]((Get-Date) - $recoveryStart).TotalSeconds
    $stamp = "T+{0:mm\:ss}" -f [timespan]::FromSeconds($elapsed)
    $tickOk = Invoke-GameTick
    if (-not $tickOk) {
        Write-Host ("  {0}  game-tick FAILED (server unreachable or errored) — retrying in 30 s" -f $stamp) -ForegroundColor Red
    }
    elseif ($elapsed -ge 300) {
        Write-Host ("  {0}  game-tick ok — the 5-minute VERIFYING window has passed." -f $stamp) -ForegroundColor Green
        Write-Note "The quest should now COMPLETE: watch the web page for 'Quest Complete' (base +30 XP, or base x seasonal multiplier if an event is active)."
        Write-Note "If the baseline was 70 XP: 70 + 30 = 100 XP, or in August (Hot Weather Challenge x1.2) 70 + 36 = 106 XP -> LEVEL UP overlay -> Bond Lv.3 either way (physical celebration: RGB + buzzer + LCD)."
        $completed = $true
    }
    else {
        Write-Host ("  {0}  game-tick ok — quest still VERIFYING ({1} s of stability remaining)" -f $stamp, (300 - $elapsed))
    }
}

if (-not $completed) {
    Write-Host ""
    Write-Host "  Reached the 6-minute cap without a successful post-window tick." -ForegroundColor Yellow
    Write-Host "  Check the dev-server logs, then reload the web page — a page load also runs" -ForegroundColor Yellow
    Write-Host "  the game tick and will settle the completion if the window has passed." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Rehearsal complete. This single vertical demo (sense -> decide -> reward -> visualize)" -ForegroundColor Green
Write-Host "is the whole pitch on camera — reset Jamkachu to Happy and the target XP before the real take." -ForegroundColor Green
exit 0
