"""Fetch a pinned LLVM-MinGW cross compiler from its official release; workspace-local."""
import hashlib
import json
import posixpath
import sys
import zipfile
from pathlib import Path
import tarfile
import urllib.request
root=Path(__file__).resolve().parents[1]
out=root/'artifacts/toolchain';out.mkdir(parents=True,exist_ok=True)
api='https://api.github.com/repos/mstorsjo/llvm-mingw/releases/tags/20260616'
request=urllib.request.Request(api,headers={'User-Agent':'ArcadeOT-build'})
release=json.load(urllib.request.urlopen(request,timeout=30))
asset_name='llvm-mingw-20260616-ucrt-x86_64.zip' if sys.platform=='win32' else 'llvm-mingw-20260616-ucrt-macos-universal.tar.xz'
asset=next(asset for asset in release['assets'] if asset['name']==asset_name)
archive=out/asset['name']
if not archive.exists():
    with urllib.request.urlopen(urllib.request.Request(asset['browser_download_url'],headers={'User-Agent':'ArcadeOT-build'}),timeout=90) as response,archive.open('wb') as file:
        while True:
            data=response.read(1024*1024)
            if not data:break
            file.write(data)
actual=hashlib.sha256(archive.read_bytes()).hexdigest()
expected=asset.get('digest')
if expected and expected!='sha256:'+actual:raise SystemExit('Toolchain checksum mismatch')
if archive.suffix=='.zip':
    with zipfile.ZipFile(archive) as zip:
        for member in zip.infolist():
            if member.filename.startswith('/') or '..' in Path(member.filename).parts or ':' in member.filename:raise SystemExit('Unsafe toolchain archive path')
        zip.extractall(out)
else:
    with tarfile.open(archive) as tar:
        for member in tar.getmembers():
            if member.name.startswith('/') or '..' in Path(member.name).parts:raise SystemExit('Unsafe toolchain archive path')
            if member.issym() or member.islnk():
                target=posixpath.normpath(posixpath.join(posixpath.dirname(member.name) if member.issym() else '',member.linkname))
                if member.linkname.startswith('/') or target.split('/')[0]!=member.name.split('/')[0]:raise SystemExit('Unsafe toolchain link')
        tar.extractall(out, filter="data")
(out/'provenance.json').write_text(json.dumps({'release':release['html_url'],'asset':asset['name'],'sha256':actual,'officialDigest':expected},indent=2)+'\n')
print(out/asset_name.removesuffix('.tar.xz').removesuffix('.zip'))
