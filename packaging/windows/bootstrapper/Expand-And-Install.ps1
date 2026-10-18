param(
    [Parameter(Mandatory=$true)][string]$SetupRoot,
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{64}$')][string]$ExpectedHash
)
function Test-PayloadArchive([string]$ZipPath) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $names = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
        $expandedBytes = [long]0
        foreach ($entry in $archive.Entries) {
            $name = $entry.FullName.Replace('\','/')
            foreach ($segment in $name.Split('/')) {
                if ($segment.Length -eq 0 -or $segment -eq '.' -or $segment -eq '..' -or $segment.EndsWith('.') -or $segment.EndsWith(' ') -or $segment -match '[<>:"|?*\x00-\x1F]' -or $segment -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)') { throw 'Invalid Windows payload path.' }
            }
            if ($name.StartsWith('/') -or $name.Contains(':') -or $name.Split('/') -contains '..' -or !$names.Add($name)) { throw 'Unsafe or repeated payload path.' }
            if ((($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'Payload symlinks are not permitted.' }
            $expandedBytes += $entry.Length
            if ($entry.Length -gt 128MB -or $expandedBytes -gt 1GB -or $names.Count -gt 2000) { throw 'Payload extraction bounds exceeded.' }
        }
    } finally { $archive.Dispose() }
}

$ErrorActionPreference = 'Stop'
$transcribing = $false
try {
    $root = [IO.Path]::GetFullPath($SetupRoot)
    if ((Get-Item -LiteralPath $root).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Setup root cannot be a reparse point.' }
    Start-Transcript -Path (Join-Path $root 'setup.log') -Force | Out-Null
    $transcribing = $true
    $zipPath = Join-Path $root 'payload.zip'
    if ((Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedHash) { throw 'Embedded payload checksum mismatch.' }
    Test-PayloadArchive $zipPath
    $payload = Join-Path $root 'payload'
    Expand-Archive -LiteralPath $zipPath -DestinationPath $payload -Force
    $manifest = Join-Path $payload 'SHA256SUMS.txt'
    $verified = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($line in [IO.File]::ReadAllLines($manifest)) {
        if ($line -notmatch '^([0-9a-f]{64})  (.+)$') { throw 'Malformed payload manifest.' }
        $expected = $Matches[1]
        $relative = $Matches[2].Replace('/',[IO.Path]::DirectorySeparatorChar)
        $file = [IO.Path]::GetFullPath((Join-Path $payload $relative))
        if (!$file.StartsWith($payload + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or !$verified.Add($file)) { throw 'Unsafe manifest path.' }
        if ((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Payload contains a reparse point.' }
        if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw "Payload checksum failed: $relative" }
    }
    $actual = @(Get-ChildItem -LiteralPath $payload -File -Recurse | Where-Object { $_.FullName -ne $manifest })
    if ($actual.Count -ne $verified.Count) { throw 'Unmanifested files in payload.' }
    Write-Host "Verified $($verified.Count) bundled files. Starting installation."
    & (Join-Path $payload 'Install.ps1') -NoLaunch
    try { Remove-Item -LiteralPath $payload -Recurse -Force; Remove-Item -LiteralPath $zipPath -Force } catch { Write-Warning 'Installation succeeded; protected setup payload cleanup remains pending.' }
    Write-Host 'Installation completed. Setup log retained in protected setup directory.'
} catch {
    Write-Host ('SETUP FAILED: ' + $_.Exception.Message)
    exit 1
} finally {
    if ($transcribing) { Stop-Transcript | Out-Null }
}
exit 0
