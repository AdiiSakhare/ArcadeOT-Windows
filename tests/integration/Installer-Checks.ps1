param([string]$Root = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent))
$ErrorActionPreference = 'Stop'
$files = @(
    (Join-Path $Root 'packaging/windows/Install.ps1'),
    (Join-Path $Root 'packaging/windows/Uninstall.ps1'),
    (Join-Path $Root 'packaging/windows/bootstrapper/Expand-And-Install.ps1'),
    (Join-Path $Root 'scripts/Build-Windows.ps1')
)
foreach ($file in $files) {
    $tokens=$null; $errors=$null
    $null = [Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors)
    if ($errors.Count -gt 0) { throw ($file + ': ' + ($errors | Out-String)) }
}
$tokens=$null; $errors=$null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $Root 'packaging/windows/bootstrapper/Expand-And-Install.ps1'),[ref]$tokens,[ref]$errors)
$function = $ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-PayloadArchive'},$true)
if ($null -eq $function) { throw 'Archive validator not found.' }
# Load just the pure validation function, never the install script body.
. ([ScriptBlock]::Create($function.Extent.Text))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$temp = Join-Path ([IO.Path]::GetTempPath()) ('arcadeot-installer-check-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
try {
    function New-FixtureZip([string]$File,[string[]]$Names,[bool]$Symlink=$false) {
        $zip=[IO.Compression.ZipFile]::Open($File,[IO.Compression.ZipArchiveMode]::Create)
        try {
            foreach ($name in $Names) {
                $entry=$zip.CreateEntry($name)
                if ($Symlink) { $entry.ExternalAttributes = [int](-1577123840) } # Unix symlink mode high bits
                $stream=$entry.Open();try { $bytes=[Text.Encoding]::UTF8.GetBytes('fixture');$stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
            }
        } finally { $zip.Dispose() }
    }
    $valid=Join-Path $temp 'valid.zip';New-FixtureZip $valid @('ui/ArcadeOT.Desktop.exe','service/ArcadeOT.Service.exe');Test-PayloadArchive $valid
    $cases=@(@('../escape.txt'),@('..\escape.txt'),@('/root.txt'),@('C:/drive.txt'),@('ui/file:stream'),@('ui/a.dll','UI/A.DLL'),@('ui/CON.txt'),@('ui/.. /escape'),@('ui/a./bad'),@('ui//bad'),@('ui/./bad'))
    $rejected=0
    foreach ($names in $cases) {
        $file=Join-Path $temp ($rejected.ToString()+'.zip');New-FixtureZip $file $names
        $failed=$false;try { Test-PayloadArchive $file } catch { $failed=$true }
        if (!$failed) { throw ('Unsafe fixture was accepted: '+($names -join ',')) }
        $rejected++
    }
    $link=Join-Path $temp 'link.zip';New-FixtureZip $link @('link') $true
    $failed=$false;try { Test-PayloadArchive $link } catch { $failed=$true }
    if (!$failed) { throw 'Archive symlink accepted.' }
    $sources=@{};foreach($file in $files){$sources[$file.Substring($Root.Length+1).Replace('\','/')]=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash}
    $report = @{Sources=$sources;Status='PASS';ScriptsParsed=$files.Count;UnsafeArchiveCasesRejected=($rejected+1);WindowsInstallationExecuted=$false}
    $report | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $Root 'artifacts/installer-checks.json') -Encoding utf8
    $report | ConvertTo-Json
} finally { Remove-Item -LiteralPath $temp -Recurse -Force }
