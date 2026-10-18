param([switch]$Quiet)
$ErrorActionPreference = 'Stop'
$systemDirectory = [Environment]::GetFolderPath('System')
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
    if ($Quiet) { $arguments += ' -Quiet' }
    $child = Start-Process -FilePath "$PSHOME\powershell.exe" -Verb RunAs -ArgumentList $arguments -Wait -PassThru
    exit $child.ExitCode
}
$target = Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'ArcadeOT2'
$data = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'ArcadeOT2'
$programs = Join-Path ([Environment]::GetFolderPath('CommonPrograms')) 'ArcadeOT'
$uninstallKey = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ArcadeOT2'
$owned = $false
$mutex = New-Object Threading.Mutex($false, 'Global\ArcadeOT2.Setup')
try {
    try { $owned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned = $true }
    if (!$owned) { throw 'Another installation or uninstall is already running.' }
    if ((Test-Path -LiteralPath $target) -and ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Installation path is a reparse point; removal refused.' }
    if (Get-Process ArcadeOT.Desktop -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$target\*" }) { throw 'Close the ArcadeOT desktop before uninstalling.' }
    if (!$Quiet) {
        $answer = Read-Host 'Remove ArcadeOT? Measurement history, configuration and credentials will be retained. Type YES to continue'
        if ($answer -cne 'YES') { Write-Host 'Uninstall cancelled.'; exit 0 }
    }
    if (Get-Service ArcadeOT2 -ErrorAction SilentlyContinue) {
        Stop-Service ArcadeOT2 -Force
        (Get-Service ArcadeOT2).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))
        & (Join-Path $systemDirectory 'sc.exe') delete ArcadeOT2 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to remove collector service.' }
    }
    Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'ArcadeOT 2.lnk') -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $programs) { Remove-Item -LiteralPath $programs -Recurse -Force }
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    if (Test-Path -LiteralPath $uninstallKey) { Remove-Item -LiteralPath $uninstallKey -Recurse -Force }
    Write-Host "ArcadeOT removed. Protected data retained at $data"
} catch {
    Write-Host ('Uninstall did not complete: ' + $_.Exception.Message)
    if (!$Quiet) { Read-Host 'Press Enter to close' | Out-Null }
    exit 1
} finally {
    if ($owned) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
if (!$Quiet) { Read-Host 'Press Enter to close' | Out-Null }
exit 0
