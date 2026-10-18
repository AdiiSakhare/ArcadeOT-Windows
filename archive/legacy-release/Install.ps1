# Run from the extracted Windows release, in an elevated PowerShell session.
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$target = Join-Path $env:ProgramFiles 'ArcadeOT'
$data = Join-Path $env:ProgramData 'ArcadeOT'
if (!(Test-Path "$PSScriptRoot\service\ArcadeOT.Service.exe") -or !(Test-Path "$PSScriptRoot\ui\arcadeOT.exe")) { throw 'Extract the complete Windows release ZIP first. Both service and ui folders are required.' }
if (Get-Service ArcadeOT -ErrorAction SilentlyContinue) { Stop-Service ArcadeOT -Force; (Get-Service ArcadeOT).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30)) }
New-Item -ItemType Directory -Force -Path $target,$data | Out-Null
# SIDs: SYSTEM, Administrators, LOCAL SERVICE. No ordinary-user API credentials.
& icacls.exe $data /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-19:(OI)(CI)M' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot secure application data directory.' }
Copy-Item "$PSScriptRoot\service" $target -Recurse -Force
Copy-Item "$PSScriptRoot\ui" $target -Recurse -Force
if (!(Test-Path "$data\api-token.txt")) {
 $bytes = New-Object byte[] 32
 $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
 try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
 [IO.File]::WriteAllText("$data\api-token.txt",[Convert]::ToBase64String($bytes))
}
$exe = '"' + "$target\service\ArcadeOT.Service.exe" + '"'
if (!(Get-Service ArcadeOT -ErrorAction SilentlyContinue)) {
 New-Service -Name ArcadeOT -BinaryPathName $exe -DisplayName 'ArcadeOT PLC Collector' -StartupType Automatic | Out-Null
}
& sc.exe config ArcadeOT binPath= $exe obj= 'NT AUTHORITY\LocalService' start= auto | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Service configuration failed.' }
& sc.exe failure ArcadeOT reset= 86400 actions= restart/5000/restart/15000/restart/60000 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Service recovery configuration failed.' }
& sc.exe failureflag ArcadeOT 1 | Out-Null
Start-Service ArcadeOT
(Get-Service ArcadeOT).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
$wsh = New-Object -ComObject WScript.Shell
$link = $wsh.CreateShortcut("$env:PUBLIC\Desktop\ArcadeOT.lnk")
$link.TargetPath = "$target\ui\arcadeOT.exe"
$link.Save()
Write-Host 'Installed. Open ArcadeOT from the desktop. The collector starts at boot without login.'
Write-Host "Data and configuration: $data"
Start-Process "$target\ui\arcadeOT.exe"
