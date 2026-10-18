#Requires -RunAsAdministrator
$ErrorActionPreference='Stop'
if(Get-Service ArcadeOT -ErrorAction SilentlyContinue){Stop-Service ArcadeOT -Force; (Get-Service ArcadeOT).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30)); & sc.exe delete ArcadeOT; if($LASTEXITCODE -ne 0){throw 'Service removal failed'}}
Remove-Item "$env:PUBLIC\Desktop\ArcadeOT.lnk" -ErrorAction SilentlyContinue
Write-Host 'Service removed. Close the UI before deleting Program Files\ArcadeOT. ProgramData\ArcadeOT is preserved, including measurements and credentials.'
