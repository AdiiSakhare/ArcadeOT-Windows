"""Fetch official, pinned macOS PowerShell for syntax and mocked installer checks."""
import hashlib
import json
from pathlib import Path
import tarfile
import urllib.request
root=Path(__file__).resolve().parents[1];out=root/'artifacts/powershell';out.mkdir(parents=True,exist_ok=True)
req=urllib.request.Request('https://api.github.com/repos/PowerShell/PowerShell/releases/tags/v7.6.0',headers={'User-Agent':'ArcadeOT-build'})
release=json.load(urllib.request.urlopen(req,timeout=30))
asset=next(a for a in release['assets'] if a['name']=='powershell-7.6.0-osx-arm64.tar.gz')
archive=out/asset['name']
if not archive.exists():
    with urllib.request.urlopen(urllib.request.Request(asset['browser_download_url'],headers={'User-Agent':'ArcadeOT-build'}),timeout=90) as response,archive.open('wb') as file:
        while True:
            data=response.read(1024*1024)
            if not data:break
            file.write(data)
actual=hashlib.sha256(archive.read_bytes()).hexdigest();expected=asset.get('digest')
if expected and expected!='sha256:'+actual:raise SystemExit('PowerShell checksum mismatch')
with tarfile.open(archive) as tar:tar.extractall(out,filter='data')
(out/'pwsh').chmod(0o755)
(out/'provenance.json').write_text(json.dumps({'release':release['html_url'],'asset':asset['name'],'sha256':actual,'officialDigest':expected},indent=2)+'\n')
print(out/'pwsh')
