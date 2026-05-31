$ErrorActionPreference = "SilentlyContinue"

$workspace = Split-Path -Parent $PSScriptRoot
$port = 4173
$nodeExe = "C:\Program Files\nodejs\node.exe"
$serverScript = Join-Path $workspace "backend\server.js"

try {
  $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/api/health" -TimeoutSec 2
  if ($response.StatusCode -eq 200) {
    exit 0
  }
} catch {
}

& $nodeExe $serverScript
