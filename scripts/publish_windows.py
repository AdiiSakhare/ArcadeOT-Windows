"""Cross-publish a Windows x64 payload. This does not execute Windows binaries."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import zipfile
from build_fingerprint import fingerprint

parser=argparse.ArgumentParser();parser.add_argument('--dotnet',default='dotnet');args=parser.parse_args()
root=Path(__file__).resolve().parents[1];artifacts=root/'artifacts';release=artifacts/'ArcadeOT-Windows-x64'
env=dict(os.environ,DOTNET_CLI_HOME=str(artifacts/'dotnet-home'),DOTNET_CLI_TELEMETRY_OPTOUT='1',DOTNET_CLI_WORKLOAD_UPDATE_NOTIFY_DISABLE='true')
verification=json.loads((artifacts/'build-verification.json').read_text())
if verification.get('sourceFingerprint') != fingerprint(root):raise SystemExit('Source/build inputs changed since verification; rerun scripts/verify_build.py.')
if verification['status']!='PASS':raise SystemExit('Run scripts/verify_build.py successfully before publishing.')
installer_checks=json.loads((artifacts/'installer-checks.json').read_text(encoding='utf-8-sig'))
if installer_checks.get('Status')!='PASS':raise SystemExit('Run the installer checks before publishing.')
for name,digest in installer_checks.get('Sources',{}).items():
    if hashlib.sha256((root/name).read_bytes()).hexdigest().upper()!=digest.upper():raise SystemExit('Installer scripts changed since checks: '+name)
if release.exists():shutil.rmtree(release)
for project,folder in [('ArcadeOT.Service','service'),('ArcadeOT.Desktop','ui')]:
    command=[args.dotnet,'publish','src/'+project,'-c','Release','-r','win-x64','--self-contained','true','-o',str(release/folder),'-p:PublishTrimmed=false','-m:1','--disable-build-servers']
    result=subprocess.run(command,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    (artifacts/(project+'-publish.log')).write_text(result.stdout)
    print(result.stdout,flush=True)
    if result.returncode:raise SystemExit(result.returncode)
    data=(release/folder/(project+'.exe')).read_bytes();offset=struct.unpack_from('<I',data,60)[0]
    assert data[:2]==b'MZ' and data[offset:offset+4]==b'PE\x00\x00' and struct.unpack_from('<H',data,offset+4)[0]==0x8664
# Debug symbols remain a separate developer artifact, not part of the runtime payload.
symbols=artifacts/'symbols-0.3.0';symbols.mkdir(exist_ok=True)
for file in release.rglob('*.pdb'):
    destination=symbols/file.relative_to(release);destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.move(str(file),destination)
for name in ['Install.ps1','Uninstall.ps1','START-HERE.md']:shutil.copy2(root/'packaging/windows'/name,release/name)
for name in ['package-audit.json','build-verification.json','service-integration.json','installer-checks.json']:
    text=(artifacts/name).read_text(encoding='utf-8-sig').replace(str(root)+'/', '')
    (release/name).write_text(text)
(release/'examples').mkdir();shutil.copy2(root/'config/examples/site.v2.disabled.json',release/'examples');shutil.copy2(root/'config/examples/sensors-template.csv',release/'examples')
licenses=release/'licenses';licenses.mkdir()
package_root=artifacts/'dotnet-home/.nuget/packages'
for package in package_root.iterdir():
    if not package.is_dir():continue
    for version in package.iterdir():
        if not version.is_dir():continue
        for file in version.iterdir():
            if file.is_file() and any(word in file.name.upper() for word in ['LICENSE','NOTICE']):
                folder=licenses/(package.name+'-'+version.name);folder.mkdir(exist_ok=True)
                shutil.copy2(file,folder/file.name)
mingw=next((root/'artifacts/toolchain').glob('llvm-mingw-20260616-ucrt-*/x86_64-w64-mingw32/share/mingw32'),Path('missing-toolchain-license'))
if mingw.is_dir():
    for file in mingw.glob('COPYING*'):
        folder=licenses/'mingw-w64-runtime';folder.mkdir(exist_ok=True);shutil.copy2(file,folder/file.name)
manifest=[]
for file in sorted(release.rglob('*')):
    if file.is_file():manifest.append(hashlib.sha256(file.read_bytes()).hexdigest()+'  '+file.relative_to(release).as_posix())
(release/'SHA256SUMS.txt').write_text('\n'.join(manifest)+'\n')
output=artifacts/'ArcadeOT-Windows-x64.zip'
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for file in sorted(release.rglob('*')):
        if file.is_file():archive.write(file,file.relative_to(release))
with zipfile.ZipFile(output) as archive:assert archive.testzip() is None
(artifacts/'windows-package.json').write_text(json.dumps({'version':'0.3.0','sourceFingerprint':fingerprint(root),'target':'win-x64','selfContained':True,'zip':output.name,'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'payloadFiles':len(manifest),'exeHeaders':'AMD64 PE','windowsExecuted':False,'signed':False},indent=2)+'\n')
print('PACKAGED',output,output.stat().st_size,flush=True)
