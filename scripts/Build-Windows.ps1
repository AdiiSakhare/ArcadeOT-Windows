# Developer/CI entry point. Runtime users only need ArcadeOT-windows-x64.exe.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    dotnet restore ArcadeOT.slnx --locked-mode
    if ($LASTEXITCODE -ne 0) { throw 'Locked restore failed.' }
    python scripts/fetch_installer_toolchain.py
    if ($LASTEXITCODE -ne 0) { throw 'Compiler fetch/checksum verification failed.' }
    python scripts/verify_build.py
    if ($LASTEXITCODE -ne 0) { throw 'Build, tests or dependency audit failed.' }
    python scripts/publish_windows.py
    if ($LASTEXITCODE -ne 0) { throw 'Windows payload publish failed.' }
    python scripts/build_installer.py
    if ($LASTEXITCODE -ne 0) { throw 'Native installer build/inspection failed.' }
    Write-Host 'Built artifacts/ArcadeOT-windows-x64.exe. Operational Windows/PLC gates remain separate.'
} finally { Pop-Location }
