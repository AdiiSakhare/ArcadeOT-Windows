$ErrorActionPreference='Stop'
Push-Location $PSScriptRoot
try {
 dotnet run --project tests/ArcadeOT.Checks -c Release
 if($LASTEXITCODE -ne 0){throw 'Protocol checks failed'}
 dotnet publish src/ArcadeOT.Service -c Release -r win-x64 --self-contained true -o release/service
 if($LASTEXITCODE -ne 0){throw 'Service build failed'}
 dotnet publish src/ArcadeOT.Desktop -c Release -r win-x64 --self-contained true -o release/ui
 if($LASTEXITCODE -ne 0){throw 'Desktop build failed'}
 Copy-Item Install.ps1,Uninstall.ps1 release -Force
}finally{Pop-Location}
