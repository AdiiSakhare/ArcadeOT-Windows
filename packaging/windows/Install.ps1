#Requires -RunAsAdministrator
param([switch]$NoLaunch)
$ErrorActionPreference = 'Stop'
$systemDirectory = [Environment]::GetFolderPath('System')
$version = '0.3.0'
$target = Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'ArcadeOT2'
$data = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'ArcadeOT2'
$programs = Join-Path ([Environment]::GetFolderPath('CommonPrograms')) 'ArcadeOT'
$staging = "$target.staging"
$backup = "$target.previous"
$serviceName = 'ArcadeOT2'
$uninstallKey = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ArcadeOT2'
$hadTarget = Test-Path -LiteralPath $target
$hadService = $null -ne (Get-Service $serviceName -ErrorAction SilentlyContinue)
$previousRegistry = $null
$registryChanged = $false
$swapped = $false
$movedPrevious = $false
$stagingCreated = $false
$mutexOwned = $false
$mutex = New-Object Threading.Mutex($false, 'Global\ArcadeOT2.Setup')

function Assert-NoReparseTree([string]$Path) {
    if (!(Test-Path -LiteralPath $Path)) { return }
    $queue = New-Object 'System.Collections.Generic.Queue[string]'
    $queue.Enqueue($Path)
    while ($queue.Count -gt 0) {
        $current = Get-Item -LiteralPath $queue.Dequeue() -Force
        if ($current.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse points are not supported in application paths: $($current.FullName)" }
        if ($current.PSIsContainer) {
            foreach ($child in Get-ChildItem -LiteralPath $current.FullName -Force) { $queue.Enqueue($child.FullName) }
        }
    }
}
function Set-ProtectedDataAcl([string]$Path) {
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
    $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
    foreach ($entry in @(@('S-1-5-18','FullControl'),@('S-1-5-32-544','FullControl'),@('S-1-5-19','Modify'))) {
        $sid = New-Object Security.Principal.SecurityIdentifier($entry[0])
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid,[Security.AccessControl.FileSystemRights]$entry[1],$inheritance,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}
function Invoke-Sc([string[]]$Arguments) {
    & (Join-Path $systemDirectory 'sc.exe') @Arguments | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Windows service operation failed: $($Arguments[0]) (exit $LASTEXITCODE)." }
}
function New-AppShortcut([string]$Path) {
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($Path)
    $link.TargetPath = "$target\ui\ArcadeOT.Desktop.exe"
    $link.WorkingDirectory = "$target\ui"
    $link.Description = 'ArcadeOT industrial workspace'
    $link.Save()
}
try {
    try { $mutexOwned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $mutexOwned = $true }
    if (!$mutexOwned) { throw 'Another ArcadeOT installation or uninstall is already running.' }
    if (![Environment]::Is64BitProcess -or [Environment]::OSVersion.Version.Build -lt 22000) { throw 'This installer targets Windows 11 on Intel/AMD x64.' }
    if (!(Test-Path -LiteralPath "$PSScriptRoot/service/ArcadeOT.Service.exe") -or !(Test-Path -LiteralPath "$PSScriptRoot/ui/ArcadeOT.Desktop.exe")) { throw 'The complete application payload is required.' }
    if ((Test-Path -LiteralPath $staging) -or (Test-Path -LiteralPath $backup)) { throw 'A staging/previous installation exists. Preserve it and inspect recovery before retrying.' }
    foreach ($path in @($target,$data,$programs)) { Assert-NoReparseTree $path }
    if (Test-Path -LiteralPath "$target/version.txt") {
        if ([Version]([IO.File]::ReadAllText("$target/version.txt").Trim()) -gt [Version]$version) { throw 'A newer ArcadeOT version is installed. Downgrade was refused.' }
    }
    if (Get-Process ArcadeOT.Desktop -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$target\*" }) { throw 'Close the ArcadeOT desktop before installing an update.' }
    $payloadSize = [long](Get-ChildItem "$PSScriptRoot/service","$PSScriptRoot/ui" -File -Recurse | Measure-Object Length -Sum).Sum
    $installDrive = New-Object IO.DriveInfo([IO.Path]::GetPathRoot($target))
    if ($installDrive.AvailableFreeSpace -lt ($payloadSize + 200MB)) { throw 'Insufficient free space on the application drive.' }
    if (Test-Path -LiteralPath $uninstallKey) { $previousRegistry = Get-ItemProperty -LiteralPath $uninstallKey }
    New-Item -ItemType Directory -Force -Path $data | Out-Null
    Set-ProtectedDataAcl $data
    if ($hadService) { Stop-Service $serviceName; (Get-Service $serviceName).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30)) }
    # Snapshot only after the service has stopped; retain WAL state and protected credentials.
    $dataFiles = @(Get-ChildItem -LiteralPath $data -File -Force)
    if ($dataFiles.Count -gt 0) {
        $dataSize = [long]($dataFiles | Measure-Object Length -Sum).Sum
        $dataDrive = New-Object IO.DriveInfo([IO.Path]::GetPathRoot($data))
        if ($dataDrive.AvailableFreeSpace -lt ($dataSize + 100MB)) { throw 'Insufficient free space for the pre-upgrade data snapshot.' }
        $saved = Join-Path $data ('backups/' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
        New-Item -ItemType Directory -Path $saved -Force | Out-Null
        foreach ($file in $dataFiles) { Copy-Item -LiteralPath $file.FullName -Destination $saved }
    }
    New-Item -ItemType Directory -Path $staging | Out-Null
    $stagingCreated = $true
    Copy-Item "$PSScriptRoot/service","$PSScriptRoot/ui" $staging -Recurse
    Copy-Item -LiteralPath "$PSScriptRoot/Uninstall.ps1" -Destination $staging
    Copy-Item -LiteralPath "$PSScriptRoot/START-HERE.md" -Destination $staging
    if (Test-Path -LiteralPath "$PSScriptRoot/licenses") { Copy-Item -LiteralPath "$PSScriptRoot/licenses" -Destination $staging -Recurse }
    [IO.File]::WriteAllText("$staging/version.txt",$version)
    if ($hadTarget) { Move-Item -LiteralPath $target -Destination $backup; $movedPrevious = $true }
    try { Move-Item -LiteralPath $staging -Destination $target; $swapped = $true }
    catch { if ($movedPrevious) { Move-Item -LiteralPath $backup -Destination $target; $movedPrevious = $false }; throw }
    if (!(Test-Path -LiteralPath "$data/api-token.txt")) {
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        [IO.File]::WriteAllText("$data/api-token.txt",[Convert]::ToBase64String($bytes))
    }
    # Reset inherited data-file ACLs to the exact protected parent permissions.
    Assert-NoReparseTree $data
    & (Join-Path $systemDirectory 'icacls.exe') "$data\*" /reset /T /C /Q | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not secure existing application data.' }
    $exe = '"' + "$target\service\ArcadeOT.Service.exe" + '"'
    if (!$hadService) { New-Service -Name $serviceName -DisplayName 'ArcadeOT Collector' -BinaryPathName $exe -StartupType Automatic | Out-Null }
    Invoke-Sc -Arguments @('config',$serviceName,'binPath=',$exe,'obj=','NT AUTHORITY\LocalService','start=','auto')
    Invoke-Sc -Arguments @('failure',$serviceName,'reset=','86400','actions=','restart/5000/restart/15000/restart/60000')
    Invoke-Sc -Arguments @('failureflag',$serviceName,'1')
    Start-Service $serviceName
    (Get-Service $serviceName).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
    $headers = @{ 'X-ArcadeOT-Key' = [IO.File]::ReadAllText("$data/api-token.txt").Trim() }
    $ready = $false
    for ($i=0; $i -lt 30; $i++) {
        try { $health = Invoke-RestMethod 'http://127.0.0.1:17846/health' -Headers $headers -TimeoutSec 2; if ($null -ne $health.Buffer) { $ready=$true; break } }
        catch { Start-Sleep -Seconds 1 }
    }
    if (!$ready) { throw 'The collector did not become healthy. Inspect Event Viewer and the retained data snapshot.' }
    New-Item -ItemType Directory -Path $programs -Force | Out-Null
    New-AppShortcut (Join-Path $programs 'ArcadeOT.lnk')
    New-AppShortcut (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'ArcadeOT 2.lnk')
    $psExe = (Join-Path $systemDirectory 'WindowsPowerShell\v1.0\powershell.exe')
    New-Item -Path $uninstallKey -Force | Out-Null
    $registryChanged = $true
    foreach ($item in @{
        DisplayName='ArcadeOT'; DisplayVersion=$version; Publisher='ArcadeOT';
        InstallLocation=$target; DisplayIcon="$target\ui\ArcadeOT.Desktop.exe,0";
        UninstallString=('"{0}" -NoProfile -ExecutionPolicy Bypass -File "{1}\Uninstall.ps1"' -f $psExe,$target);
        QuietUninstallString=('"{0}" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{1}\Uninstall.ps1" -Quiet' -f $psExe,$target)
    }.GetEnumerator()) { New-ItemProperty -Path $uninstallKey -Name $item.Key -Value $item.Value -PropertyType String -Force | Out-Null }
    New-ItemProperty -Path $uninstallKey -Name NoModify -Value 1 -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $uninstallKey -Name NoRepair -Value 1 -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $uninstallKey -Name EstimatedSize -Value ([int][Math]::Ceiling($payloadSize/1KB)) -PropertyType DWord -Force | Out-Null
    Write-Host "Installed ArcadeOT $version. The collector starts automatically at boot."
    # Cleanup failure is reported as a warning; a healthy new installation is not rolled back for this.
    if (Test-Path -LiteralPath $backup) { try { Remove-Item -LiteralPath $backup -Recurse -Force } catch { Write-Warning 'Installed successfully; the previous binary directory could not be cleaned up.' } }
    if (!$NoLaunch) { try { Start-Process "$target/ui/ArcadeOT.Desktop.exe" } catch { Write-Warning 'Installed successfully; open ArcadeOT from the Start menu.' } }
} catch {
    $failure = $_
    try {
        if ($swapped -or $movedPrevious) {
            if (Get-Service $serviceName -ErrorAction SilentlyContinue) { Stop-Service $serviceName -Force -ErrorAction SilentlyContinue }
            if ($swapped -and (Test-Path -LiteralPath $target)) { Remove-Item -LiteralPath $target -Recurse -Force }
            if ($movedPrevious -and (Test-Path -LiteralPath $backup)) { Move-Item -LiteralPath $backup -Destination $target }
        }
        if (!$hadService -and (Get-Service $serviceName -ErrorAction SilentlyContinue)) { Invoke-Sc -Arguments @('delete',$serviceName) }
        if ($stagingCreated -and (Test-Path -LiteralPath $staging)) { Remove-Item -LiteralPath $staging -Recurse -Force }
        if ($registryChanged) {
            Remove-Item -LiteralPath $uninstallKey -Recurse -Force
            if ($null -ne $previousRegistry) {
                New-Item -Path $uninstallKey -Force | Out-Null
                foreach ($property in $previousRegistry.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' }) {
                    $kind = if ($property.Value -is [int]) { 'DWord' } else { 'String' }
                    New-ItemProperty -Path $uninstallKey -Name $property.Name -Value $property.Value -PropertyType $kind -Force | Out-Null
                }
            }
        }
        if ($hadService -and (Test-Path -LiteralPath "$target/service/ArcadeOT.Service.exe") -and (Get-Service $serviceName).Status -ne 'Running') { Start-Service $serviceName }
    } catch { Write-Warning "Binary rollback could not finish: $($_.Exception.Message). Preserve backups and inspect service state." }
    throw $failure
} finally {
    if ($mutexOwned) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
