#Requires -Version 7.0
<#
.SYNOPSIS
    LeafTalk failure tests for POST /api/device-events (handoff Phase 19).

.DESCRIPTION
    Runs 8 sequential named checks against a running dev server (npm run dev)
    and prints PASS/FAIL with expected vs actual for each. A failing check
    never aborts the run; the script exits 1 if any check failed, 0 otherwise.

    Contract under test (src/app/api/device-events/route.ts + src/types/events.ts):
      * 200 {ok, eventId, duplicate, applied} on success
      * duplicate:true when the same eventId is resent (XP-once guarantee, handoff §28)
      * applied:false when a newer state_changed_at already exists (stale event guard)
      * 400 on validation failure (bad mood, occurredAt without offset, occurredAt
        more than 10 minutes in the future)
      * 404 on unknown plantId
      * 401 on missing/wrong bearer token — only when DEVICE_API_TOKEN is set server-side

.EXAMPLE
    pwsh -File scripts/test-device-events.ps1

.EXAMPLE
    pwsh -File scripts/test-device-events.ps1 -BaseUrl http://localhost:3000 -PlantId plant-01 -Token my-secret
#>
[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$PlantId = "plant-01",
    # Optional shared token. When given, all valid requests send it and check 8
    # verifies that missing/wrong tokens get 401. When omitted, check 8 is skipped.
    [string]$Token
)

$endpoint = "$BaseUrl/api/device-events"
$script:passCount = 0
$script:failCount = 0
$script:skipCount = 0

function New-EventId {
    param([Parameter(Mandatory)][string]$Suffix)
    # Globally unique (eventId must be a non-empty string, max 128 chars).
    "evt-test-$([guid]::NewGuid().ToString('N'))-$Suffix"
}

function Get-AuthHeaders {
    $headers = @{}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    return $headers
}

function Invoke-DeviceEvents {
    param(
        [Parameter(Mandatory)][string]$Json,
        [hashtable]$Headers
    )
    if ($null -eq $Headers) { $Headers = Get-AuthHeaders }
    try {
        $statusCode = 0
        $body = Invoke-RestMethod -Uri $endpoint -Method Post -ContentType "application/json" `
            -Body $Json -Headers $Headers -SkipHttpErrorCheck -StatusCodeVariable statusCode -ErrorAction Stop
        return [pscustomobject]@{ Status = [int]$statusCode; Body = $body; TransportError = $null }
    }
    catch {
        # Connection refused / DNS / TLS — the server never answered.
        return [pscustomobject]@{ Status = -1; Body = $null; TransportError = $_.Exception.Message }
    }
}

function Format-Response {
    param($Response)
    if ($Response.TransportError) { return "no HTTP response (transport error: $($Response.TransportError))" }
    $bodyText = if ($null -ne $Response.Body) { $Response.Body | ConvertTo-Json -Compress -Depth 5 } else { "<empty body>" }
    return "HTTP $($Response.Status) $bodyText"
}

function Write-Check {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Expected,
        [Parameter(Mandatory)][string]$Actual,
        [Parameter(Mandatory)][bool]$Passed,
        [string]$Hint
    )
    if ($Passed) {
        $script:passCount++
        Write-Host ("PASS  {0}" -f $Name) -ForegroundColor Green
    }
    else {
        $script:failCount++
        Write-Host ("FAIL  {0}" -f $Name) -ForegroundColor Red
    }
    Write-Host ("      expected: {0}" -f $Expected)
    Write-Host ("      actual:   {0}" -f $Actual)
    if (-not $Passed -and $Hint) {
        Write-Host ("      hint:     {0}" -f $Hint) -ForegroundColor Yellow
    }
}

Write-Host "LeafTalk device-events failure tests (handoff Phase 19)" -ForegroundColor Cyan
Write-Host "Target: $endpoint  plantId: $PlantId  auth: $(if ($Token) { 'bearer token supplied' } else { 'none' })"
Write-Host ""

# ---------------------------------------------------------------------------
# 1. Valid PLANT_STATE_CHANGED — unique eventId, occurredAt with local offset
#    (Get-Date).ToString("o") emits e.g. 2026-08-07T12:00:00.1234567+07:00,
#    which satisfies the strict ISO-with-offset validator.
# ---------------------------------------------------------------------------
$validEventId = New-EventId "valid"
$validJson = @{
    eventId    = $validEventId
    plantId    = $PlantId
    type       = "PLANT_STATE_CHANGED"
    occurredAt = (Get-Date).ToString("o")
    data       = @{ currentState = "Happy"; source = "test-device-events.ps1" }
} | ConvertTo-Json -Depth 5

$r1 = Invoke-DeviceEvents -Json $validJson
Write-Check -Name "1. valid PLANT_STATE_CHANGED accepted" `
    -Expected "HTTP 200, ok:true, duplicate:false" `
    -Actual (Format-Response $r1) `
    -Passed ($r1.Status -eq 200 -and $r1.Body.ok -eq $true -and $r1.Body.duplicate -eq $false) `
    -Hint "Is the dev server running at $BaseUrl with Supabase configured (.env.local + supabase/milestone1.sql)?"

# ---------------------------------------------------------------------------
# 2. Exact same eventId resent — idempotency / XP-once guarantee (handoff §28).
#    The server must answer 200 with duplicate:true and store nothing new.
# ---------------------------------------------------------------------------
$r2 = Invoke-DeviceEvents -Json $validJson
Write-Check -Name "2. duplicate eventId ignored (XP awarded only once, handoff §28)" `
    -Expected "HTTP 200, ok:true, duplicate:true" `
    -Actual (Format-Response $r2) `
    -Passed ($r2.Status -eq 200 -and $r2.Body.ok -eq $true -and $r2.Body.duplicate -eq $true)

# ---------------------------------------------------------------------------
# 3. Invalid mood in data.currentState — allowed values are
#    Happy, Overheating, DryAir, Sleepy, SoilAcidic, SoilAlkaline.
# ---------------------------------------------------------------------------
$r3 = Invoke-DeviceEvents -Json (@{
    eventId    = New-EventId "badmood"
    plantId    = $PlantId
    type       = "PLANT_STATE_CHANGED"
    occurredAt = (Get-Date).ToString("o")
    data       = @{ currentState = "Angry" }
} | ConvertTo-Json -Depth 5)
Write-Check -Name "3. invalid mood in data.currentState rejected" `
    -Expected "HTTP 400 (data.currentState must be one of the six moods)" `
    -Actual (Format-Response $r3) `
    -Passed ($r3.Status -eq 400)

# ---------------------------------------------------------------------------
# 4. occurredAt without a timezone offset — a zone-less timestamp would be
#    reinterpreted (UTC vs UTC+7) and freeze the state guard, so the API
#    rejects it at the trust boundary.
# ---------------------------------------------------------------------------
$r4 = Invoke-DeviceEvents -Json (@{
    eventId    = New-EventId "nooffset"
    plantId    = $PlantId
    type       = "PLANT_STATE_CHANGED"
    occurredAt = "2026-08-07T12:00:00"
    data       = @{ currentState = "Happy" }
} | ConvertTo-Json -Depth 5)
Write-Check -Name "4. occurredAt without timezone offset rejected" `
    -Expected "HTTP 400 (ISO 8601 with offset required, e.g. 2026-08-07T12:00:00+07:00)" `
    -Actual (Format-Response $r4) `
    -Passed ($r4.Status -eq 400)

# ---------------------------------------------------------------------------
# 5. occurredAt 1 hour in the future — the validator tolerates 10 minutes of
#    clock skew; beyond that it flags a misconfigured device clock.
# ---------------------------------------------------------------------------
$r5 = Invoke-DeviceEvents -Json (@{
    eventId    = New-EventId "future"
    plantId    = $PlantId
    type       = "PLANT_STATE_CHANGED"
    occurredAt = (Get-Date).AddHours(1).ToString("o")
    data       = @{ currentState = "Happy" }
} | ConvertTo-Json -Depth 5)
Write-Check -Name "5. occurredAt 1 hour in the future rejected (max 10 min skew)" `
    -Expected "HTTP 400 (occurredAt more than 10 minutes in the future)" `
    -Actual (Format-Response $r5) `
    -Passed ($r5.Status -eq 400)

# ---------------------------------------------------------------------------
# 6. Unknown plantId — validation passes, but the plant row does not exist.
# ---------------------------------------------------------------------------
$r6 = Invoke-DeviceEvents -Json (@{
    eventId    = New-EventId "noplant"
    plantId    = "plant-does-not-exist"
    type       = "PLANT_STATE_CHANGED"
    occurredAt = (Get-Date).ToString("o")
    data       = @{ currentState = "Happy" }
} | ConvertTo-Json -Depth 5)
Write-Check -Name "6. unknown plantId rejected" `
    -Expected "HTTP 404 (unknown plantId: plant-does-not-exist)" `
    -Actual (Format-Response $r6) `
    -Passed ($r6.Status -eq 404)

# ---------------------------------------------------------------------------
# 7. Stale event — apply a fresh event first, then send one whose occurredAt
#    is 2 minutes older. The state_changed_at guard must keep the newer state:
#    the stale event is stored (duplicate:false) but applied:false.
# ---------------------------------------------------------------------------
$freshTime = Get-Date
$rFresh = Invoke-DeviceEvents -Json (@{
    eventId    = New-EventId "fresh"
    plantId    = $PlantId
    type       = "PLANT_STATE_CHANGED"
    occurredAt = $freshTime.ToString("o")
    data       = @{ currentState = "Happy" }
} | ConvertTo-Json -Depth 5)

if ($rFresh.Status -ne 200 -or $rFresh.Body.ok -ne $true) {
    Write-Check -Name "7. stale event cannot overwrite a newer state" `
        -Expected "setup: fresh event accepted (HTTP 200 ok:true), then stale event applied:false" `
        -Actual ("setup request failed: " + (Format-Response $rFresh)) `
        -Passed $false
}
else {
    $r7 = Invoke-DeviceEvents -Json (@{
        eventId    = New-EventId "stale"
        plantId    = $PlantId
        type       = "PLANT_STATE_CHANGED"
        occurredAt = $freshTime.AddMinutes(-2).ToString("o")
        data       = @{ previousState = "Happy"; currentState = "Overheating"; temperature = 34.2 }
    } | ConvertTo-Json -Depth 5)
    Write-Check -Name "7. stale event (2 min older than freshly applied state) not applied" `
        -Expected "HTTP 200, ok:true, duplicate:false, applied:false" `
        -Actual (Format-Response $r7) `
        -Passed ($r7.Status -eq 200 -and $r7.Body.ok -eq $true -and $r7.Body.duplicate -eq $false -and $r7.Body.applied -eq $false)
}

# ---------------------------------------------------------------------------
# 8. Auth — only meaningful when the server has DEVICE_API_TOKEN set. Both a
#    missing Authorization header and a wrong token must get 401.
# ---------------------------------------------------------------------------
if (-not $Token) {
    $script:skipCount++
    Write-Host "SKIP  8. missing/wrong bearer token rejected (no -Token given; server-side auth is only enforced when DEVICE_API_TOKEN is set)" -ForegroundColor Yellow
}
else {
    $authProbeJson = @{
        eventId    = New-EventId "auth"
        plantId    = $PlantId
        type       = "PLANT_STATE_CHANGED"
        occurredAt = (Get-Date).ToString("o")
        data       = @{ currentState = "Happy" }
    } | ConvertTo-Json -Depth 5
    $r8Missing = Invoke-DeviceEvents -Json $authProbeJson -Headers @{}
    $r8Wrong = Invoke-DeviceEvents -Json $authProbeJson -Headers @{ Authorization = "Bearer definitely-not-the-token" }
    Write-Check -Name "8. missing/wrong bearer token rejected" `
        -Expected "HTTP 401 for missing header AND HTTP 401 for wrong token" `
        -Actual ("missing header: " + (Format-Response $r8Missing) + " | wrong token: " + (Format-Response $r8Wrong)) `
        -Passed ($r8Missing.Status -eq 401 -and $r8Wrong.Status -eq 401) `
        -Hint "If both returned 200, the server is not enforcing auth: set DEVICE_API_TOKEN in .env.local and restart 'npm run dev'."
}

# ---------------------------------------------------------------------------
Write-Host ""
Write-Host ("Result: {0} passed, {1} failed, {2} skipped" -f $script:passCount, $script:failCount, $script:skipCount) `
    -ForegroundColor $(if ($script:failCount -gt 0) { "Red" } else { "Green" })

if ($script:failCount -gt 0) { exit 1 }
exit 0
