param(
  [string]$Device = "",
  [string]$Package = "",
  [string]$Csv = "",
  [switch]$AllowAnyApp,
  [int]$DefaultDelayMs = 500,
  [int]$Repeat = 1,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Usage {
  Write-Host @"
Android touch test runner

Usage:
  powershell -ExecutionPolicy Bypass -File .\tools\android-touch-test.ps1 -Package com.example.app -Csv .\tools\touch-sequence.sample.csv
  powershell -ExecutionPolicy Bypass -File .\tools\android-touch-test.ps1 -Package com.example.app -Repeat 3

CSV columns:
  action,x,y,x2,y2,durationMs,text,key,delayMs

Actions:
  tap      x,y
  swipe    x,y,x2,y2,durationMs
  text     text
  key      key
  wait     delayMs

Notes:
  - Use this for apps you own or are authorized to test.
  - By default, -Package is required and the script checks the foreground app before every input.
  - Use -AllowAnyApp only for local test screens where package checking is not needed.
"@
}

function Invoke-Adb {
  param([string[]]$Args)

  $adbArgs = @()
  if ($Device.Trim().Length -gt 0) {
    $adbArgs += @("-s", $Device)
  }
  $adbArgs += $Args

  if ($DryRun) {
    Write-Host "adb $($adbArgs -join ' ')"
    return ""
  }

  $output = & adb @adbArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "adb failed: $output"
  }
  return ($output -join "`n")
}

function Get-ForegroundPackage {
  $window = Invoke-Adb @("shell", "dumpsys", "window", "windows")
  $match = [regex]::Match($window, "mCurrentFocus=.*?\s([A-Za-z0-9_.]+)\/")
  if (-not $match.Success) {
    $match = [regex]::Match($window, "mFocusedApp=.*?\s([A-Za-z0-9_.]+)\/")
  }
  if ($match.Success) {
    return $match.Groups[1].Value
  }
  return ""
}

function Assert-AllowedTarget {
  if ($AllowAnyApp) {
    return
  }

  if ($Package.Trim().Length -eq 0) {
    throw "Provide -Package com.example.app, or pass -AllowAnyApp for a local test screen."
  }

  $foreground = Get-ForegroundPackage
  if ($foreground -ne $Package) {
    throw "Foreground app is '$foreground', expected '$Package'. Open the target app and run again."
  }
}

function Invoke-Step {
  param([object]$Step)

  $action = ($Step.action + "").Trim().ToLowerInvariant()
  if ($action.Length -eq 0) {
    return
  }

  Assert-AllowedTarget

  switch ($action) {
    "tap" {
      Invoke-Adb @("shell", "input", "tap", "$($Step.x)", "$($Step.y)") | Out-Null
    }
    "swipe" {
      $duration = if (($Step.durationMs + "").Trim().Length -gt 0) { "$($Step.durationMs)" } else { "300" }
      Invoke-Adb @("shell", "input", "swipe", "$($Step.x)", "$($Step.y)", "$($Step.x2)", "$($Step.y2)", $duration) | Out-Null
    }
    "text" {
      $encoded = ($Step.text + "").Replace(" ", "%s")
      Invoke-Adb @("shell", "input", "text", $encoded) | Out-Null
    }
    "key" {
      Invoke-Adb @("shell", "input", "keyevent", "$($Step.key)") | Out-Null
    }
    "wait" {
      # Delay is handled below.
    }
    default {
      throw "Unknown action '$action'."
    }
  }

  $delay = if (($Step.delayMs + "").Trim().Length -gt 0) { [int]$Step.delayMs } else { $DefaultDelayMs }
  if ($delay -gt 0) {
    Start-Sleep -Milliseconds $delay
  }
}

if ($Csv.Trim().Length -eq 0) {
  Write-Usage
  exit 0
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  throw "adb was not found in PATH. Install Android Platform Tools and try again."
}

if ($Repeat -lt 1) {
  throw "-Repeat must be 1 or greater."
}

if (-not (Test-Path -LiteralPath $Csv)) {
  throw "CSV not found: $Csv"
}

$steps = Import-Csv -LiteralPath $Csv
if ($steps.Count -eq 0) {
  throw "CSV has no steps: $Csv"
}

for ($i = 1; $i -le $Repeat; $i++) {
  Write-Host "Run $i / $Repeat"
  foreach ($step in $steps) {
    Invoke-Step $step
  }
}

Write-Host "Done."
