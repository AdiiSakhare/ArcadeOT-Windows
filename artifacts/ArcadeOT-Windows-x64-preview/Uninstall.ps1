#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$target = Join-Path $env:ProgramFiles 'ArcadeOT2'
if (Get-Process ArcadeOT.Desktop -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$target\*" }) { throw 'Close the ArcadeOT2 desktop first.' }
if (Get-Service ArcadeOT2 -ErrorAction SilentlyContinue) {
    Stop-Service ArcadeOT2 -Force
    (Get-Service ArcadeOT2).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))
    & sc.exe delete ArcadeOT2 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to remove service.' }
}
Remove-Item "$env:PUBLIC\Desktop\ArcadeOT 2.lnk" -ErrorAction SilentlyContinue
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Write-Host 'ArcadeOT2 service and binaries removed. ProgramData\ArcadeOT2 measurements, configuration history, credentials and backups are retained.'
