#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$target = Join-Path $env:ProgramFiles 'ArcadeOT2'
$data = Join-Path $env:ProgramData 'ArcadeOT2'
$staging = "$target.staging"
$backup = "$target.previous"
$serviceName = 'ArcadeOT2'
$hadTarget = Test-Path $target
$hadService = $null -ne (Get-Service $serviceName -ErrorAction SilentlyContinue)
if (!(Test-Path "$PSScriptRoot/service/ArcadeOT.Service.exe") -or !(Test-Path "$PSScriptRoot/ui/ArcadeOT.Desktop.exe")) { throw 'Extract the complete preview distribution before installing.' }
# A previous failed installation must be inspected, not silently overwritten.
if ((Test-Path $staging) -or (Test-Path $backup)) { throw 'Staging/previous installation exists. Inspect it and resolve recovery before retrying.' }
$activeUi = Get-Process ArcadeOT.Desktop -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$target\*" }
if ($activeUi) { throw 'Close the ArcadeOT2 desktop before upgrading.' }
New-Item -ItemType Directory -Force -Path $data | Out-Null
& icacls.exe $data /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-19:(OI)(CI)M' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Unable to protect the data directory.' }
if ($hadService) { Stop-Service $serviceName; (Get-Service $serviceName).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30)) }
# Service is stopped before taking the data backup, including WAL state and history.
if (Test-Path "$data/arcadeot.db") {
    $saved = Join-Path $data ('backups/' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
    New-Item -ItemType Directory -Path $saved -Force | Out-Null
    Get-ChildItem $data -File | Copy-Item -Destination $saved
}
try {
    New-Item -ItemType Directory -Path $staging | Out-Null
    Copy-Item "$PSScriptRoot/service","$PSScriptRoot/ui" $staging -Recurse
    if ($hadTarget) { Move-Item $target $backup }
    Move-Item $staging $target
    if (!(Test-Path "$data/api-token.txt")) {
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        [IO.File]::WriteAllText("$data/api-token.txt",[Convert]::ToBase64String($bytes))
    }
    $exe = '"' + "$target\service\ArcadeOT.Service.exe" + '"'
    if (!$hadService) { New-Service -Name $serviceName -DisplayName 'ArcadeOT 2 Collector' -BinaryPathName $exe -StartupType Automatic | Out-Null }
    & sc.exe config $serviceName binPath= $exe obj= 'NT AUTHORITY\LocalService' start= auto | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Service configuration failed.' }
    & sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/15000/restart/60000 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Service recovery setup failed.' }
    & sc.exe failureflag $serviceName 1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Service failure flag setup failed.' }
    Start-Service $serviceName
    (Get-Service $serviceName).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
    $headers = @{ 'X-ArcadeOT-Key' = [IO.File]::ReadAllText("$data/api-token.txt").Trim() }
    $ready = $false
    for ($i=0; $i -lt 30; $i++) {
        try { $null = Invoke-RestMethod 'http://127.0.0.1:17846/health' -Headers $headers -TimeoutSec 2; $ready=$true; break }
        catch { Start-Sleep -Seconds 1 }
    }
    if (!$ready) { throw 'Service did not become healthy. Inspect Event Viewer and the retained data backup.' }
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut("$env:PUBLIC\Desktop\ArcadeOT 2.lnk")
    $link.TargetPath = "$target\ui\ArcadeOT.Desktop.exe"; $link.Save()
    if (Test-Path $backup) { Remove-Item $backup -Recurse -Force }
    Write-Host 'Installed ArcadeOT2. Data backups are retained in the protected ProgramData directory.'
    Start-Process "$target/ui/ArcadeOT.Desktop.exe"
} catch {
    $failure = $_
    try {
        if (Get-Service $serviceName -ErrorAction SilentlyContinue) { Stop-Service $serviceName -Force -ErrorAction SilentlyContinue }
        if (Test-Path $backup) {
            if (Test-Path $target) { Remove-Item $target -Recurse -Force }
            Move-Item $backup $target
            if ($hadService) { Start-Service $serviceName }
        } elseif (!$hadTarget -and (Test-Path $target)) { Remove-Item $target -Recurse -Force }
        if (!$hadService -and (Get-Service $serviceName -ErrorAction SilentlyContinue)) { & sc.exe delete $serviceName | Out-Null }
        if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
        if ($hadService -and (Test-Path "$target/service/ArcadeOT.Service.exe") -and (Get-Service $serviceName).Status -ne 'Running') { Start-Service $serviceName }
    } catch { Write-Warning "Automatic binary rollback failed: $($_.Exception.Message). Preserve backups and inspect service state." }
    throw $failure
}
