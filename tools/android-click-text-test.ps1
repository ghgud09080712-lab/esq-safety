param(
  [string]$Device = "",
  [string]$Package = "",
  [string]$Text,
  [switch]$Contains,
  [switch]$AllowAnyApp,
  [int]$TimeoutSec = 10,
  [int]$PollMs = 500,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Usage {
  Write-Host @"
Android click text test runner

Usage:
  powershell -ExecutionPolicy Bypass -File .\tools\android-click-text-test.ps1 -Package com.example.app -Text "OK"
  powershell -ExecutionPolicy Bypass -File .\tools\android-click-text-test.ps1 -Package com.example.app -Text "Save" -Contains

Options:
  -Text         Exact text or content description to click.
  -Contains     Match when the screen text contains -Text.
  -TimeoutSec   Seconds to wait for the text. Default: 10
  -PollMs       Retry interval in milliseconds. Default: 500

Notes:
  - Use this for apps you own or are authorized to test.
  - By default, -Package is required and the script checks the foreground app before tapping.
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

function Get-UiXml {
  Invoke-Adb @("shell", "uiautomator", "dump", "/sdcard/window_dump.xml") | Out-Null
  return Invoke-Adb @("exec-out", "cat", "/sdcard/window_dump.xml")
}

function Convert-BoundsToCenter {
  param([string]$Bounds)

  $match = [regex]::Match($Bounds, "^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$")
  if (-not $match.Success) {
    throw "Invalid bounds: $Bounds"
  }

  $left = [int]$match.Groups[1].Value
  $top = [int]$match.Groups[2].Value
  $right = [int]$match.Groups[3].Value
  $bottom = [int]$match.Groups[4].Value

  return @{
    X = [int](($left + $right) / 2)
    Y = [int](($top + $bottom) / 2)
  }
}

function Find-NodeByText {
  param([xml]$Xml, [string]$Needle, [bool]$UseContains)

  $nodes = $Xml.SelectNodes("//node[@text or @content-desc]")
  foreach ($node in $nodes) {
    $nodeText = ($node.text + "")
    $nodeDesc = ($node.'content-desc' + "")

    if ($UseContains) {
      if ($nodeText.Contains($Needle) -or $nodeDesc.Contains($Needle)) {
        return $node
      }
    } else {
      if ($nodeText -eq $Needle -or $nodeDesc -eq $Needle) {
        return $node
      }
    }
  }

  return $null
}

if ($Text.Trim().Length -eq 0) {
  Write-Usage
  exit 0
}

if ($TimeoutSec -lt 1) {
  throw "-TimeoutSec must be 1 or greater."
}

if ($PollMs -lt 100) {
  throw "-PollMs must be 100 or greater."
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  throw "adb was not found in PATH. Install Android Platform Tools and try again."
}

Assert-AllowedTarget

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$found = $null

while ((Get-Date) -lt $deadline) {
  Assert-AllowedTarget

  [xml]$xml = Get-UiXml
  $found = Find-NodeByText -Xml $xml -Needle $Text -UseContains:$Contains
  if ($null -ne $found) {
    break
  }

  Start-Sleep -Milliseconds $PollMs
}

if ($null -eq $found) {
  throw "Could not find text '$Text' within $TimeoutSec seconds."
}

$center = Convert-BoundsToCenter -Bounds $found.bounds
Write-Host "Found '$Text' at $($found.bounds), tapping $($center.X),$($center.Y)"
Invoke-Adb @("shell", "input", "tap", "$($center.X)", "$($center.Y)") | Out-Null
Write-Host "Done."
