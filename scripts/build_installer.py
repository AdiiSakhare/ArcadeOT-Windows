"""Build and inspect the native, single-download Windows installer on macOS."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import struct
import subprocess
import zipfile
import zlib

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
host='x86_64' if sys.platform=='win32' else 'macos-universal'
parser.add_argument('--toolchain',default=str(ROOT/('artifacts/toolchain/llvm-mingw-20260616-ucrt-'+host)))
args=parser.parse_args()
toolchain=Path(args.toolchain)
work=ROOT/'artifacts/installer-build';work.mkdir(parents=True,exist_ok=True)
payload=ROOT/'artifacts/ArcadeOT-Windows-x64.zip'
source=ROOT/'packaging/windows/bootstrapper'
output=ROOT/'artifacts/ArcadeOT-windows-x64.exe'
package=json.loads((ROOT/'artifacts/windows-package.json').read_text())
verification=json.loads((ROOT/'artifacts/build-verification.json').read_text())
if package.get('sourceFingerprint') != verification.get('sourceFingerprint'):raise SystemExit('Payload inputs differ from the verified build.')
if package['version']!='0.3.0' or hashlib.sha256(payload.read_bytes()).hexdigest()!=package['sha256']:
    raise SystemExit('Publish a verified version 0.3.0 payload first.')

# Verify all paths before embedding. Case-insensitive collisions are unsafe on Windows.
with zipfile.ZipFile(payload) as archive:
    names=set();expanded=0
    for entry in archive.infolist():
        name=entry.filename.replace('\\','/')
        if name.startswith('/') or ':' in name or '..' in Path(name).parts or name.casefold() in names:
            raise SystemExit('Unsafe payload path: '+name)
        names.add(name.casefold());expanded+=entry.file_size
        if entry.file_size>128*1024*1024 or expanded>1024**3 or len(names)>2000 or (entry.external_attr>>16)&0xF000==0xA000:
            raise SystemExit('Payload extraction bounds exceeded')
    if archive.testzip() is not None:raise SystemExit('Payload ZIP integrity failure')
digest=package['sha256']
(work/'payload.h').write_text('#define PAYLOAD_SHA256 L"'+digest+'"\n#define REQUIRED_STAGE_BYTES 1610612736ULL\n')

# Small code-generated brand icon; PNG image slots are supported by Windows 11.
def png(size):
    rows=[]
    for y in range(size):
        row=bytearray()
        for x in range(size):
            sums=[0,0,0,0]
            for sy in range(4):
                for sx in range(4):
                    xx=(x+(sx+.5)/4)/size;yy=(y+(sy+.5)/4)/size
                    cx=min(.82,max(.18,xx));cy=min(.82,max(.18,yy))
                    inside=(xx-cx)**2+(yy-cy)**2<=.18**2
                    if not inside:rgba=(0,0,0,0)
                    else:
                        left=.50-(yy-.19)*.46;right=1-left
                        letter=.19<=yy<=.81 and (abs(xx-left)<.044 or abs(xx-right)<.044 or (.54<yy<.61 and left<xx<right))
                        rgba=(255,255,255,255) if letter else (8,127,117,255)
                    for i in range(4):sums[i]+=rgba[i]
            row.extend(round(v/16) for v in sums)
        rows.append(b'\x00'+bytes(row))
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
images=[(size,png(size)) for size in [16,32,48,256]];offset=6+16*len(images);entries=[]
for size,data in images:
    entries.append(struct.pack('<BBBBHHII',size%256,size%256,0,0,1,32,len(data),offset));offset+=len(data)
icon=work/'ArcadeOT.ico';icon.write_bytes(struct.pack('<HHH',0,1,len(images))+b''.join(entries)+b''.join(data for _,data in images))
rc=work/'setup.rc'
def quoted(path):return '"'+str(path).replace('\\','/')+'"'
rc.write_text('''#include <windows.h>
1 ICON '''+quoted(icon)+'''
1 RT_MANIFEST '''+quoted(source/'setup.manifest')+'''
101 RCDATA '''+quoted(payload)+'''
102 RCDATA '''+quoted(source/'Expand-And-Install.ps1')+'''
1 VERSIONINFO
FILEVERSION 0,3,0,0
PRODUCTVERSION 0,3,0,0
FILEFLAGSMASK 0x3fL
FILEFLAGS 0
FILEOS 0x40004L
FILETYPE 0x1L
FILESUBTYPE 0
BEGIN
 BLOCK "StringFileInfo"
 BEGIN
  BLOCK "040904b0"
  BEGIN
   VALUE "CompanyName", "ArcadeOT\\0"
   VALUE "FileDescription", "ArcadeOT Windows x64 Installer\\0"
   VALUE "FileVersion", "0.3.0.0\\0"
   VALUE "ProductName", "ArcadeOT\\0"
   VALUE "ProductVersion", "0.3.0\\0"
   VALUE "OriginalFilename", "ArcadeOT-windows-x64.exe\\0"
  END
 END
 BLOCK "VarFileInfo"
 BEGIN
  VALUE "Translation", 0x409, 1200
 END
END
''')
suffix='.exe' if sys.platform=='win32' else ''
commands=[
 [str(toolchain/('bin/x86_64-w64-mingw32-windres'+suffix)),'-I',str(work),str(rc),'-O','coff','-o',str(work/'setup.res.o')],
 [str(toolchain/('bin/x86_64-w64-mingw32-clang'+suffix)),'-std=c17','-Os','-Wall','-Wextra','-Werror','-municode','-mwindows','-I',str(work),str(source/'setup.c'),str(work/'setup.res.o'),'-o',str(output),'-Wl,--dynamicbase,--nxcompat,--high-entropy-va,--no-insert-timestamp','-lbcrypt','-lcomctl32','-lshell32','-lole32','-ladvapi32','-luuid','-luser32','-lgdi32']]
for command in commands:
    result=subprocess.run(command,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    print(result.stdout,end='',flush=True)
    if result.returncode:raise SystemExit(result.returncode)
# Independent PE/resource inspection, without executing the Windows program.
blob=output.read_bytes();pe=struct.unpack_from('<I',blob,60)[0]
assert blob[:2]==b'MZ' and blob[pe:pe+4]==b'PE\0\0'
machine,count=struct.unpack_from('<HH',blob,pe+4);assert machine==0x8664
optional=pe+24;assert struct.unpack_from('<H',blob,optional)[0]==0x20b
optional_size=struct.unpack_from('<H',blob,pe+20)[0]
sections=[]
for index in range(count):
    at=optional+optional_size+index*40
    virtual_size,rva,raw_size,raw=struct.unpack_from('<IIII',blob,at+8)
    sections.append((rva,max(virtual_size,raw_size),raw))
def address(rva):
    for base,size,raw in sections:
        if base<=rva<base+size:return raw+rva-base
    raise AssertionError('Unmapped PE address')
assert struct.unpack_from('<H',blob,optional+68)[0]==2 # Windows GUI subsystem
flags=struct.unpack_from('<H',blob,optional+70)[0];assert flags&0x160==0x160
resource_rva,resource_size=struct.unpack_from('<II',blob,optional+112+2*8);resource_base=address(resource_rva)
resources={}
def walk(relative,path=()):
    at=resource_base+relative;named,ids=struct.unpack_from('<HH',blob,at+12)
    for index in range(named+ids):
        name,target=struct.unpack_from('<II',blob,at+16+index*8)
        assert not name&0x80000000,'Unexpected named installer resource'
        if target&0x80000000:walk(target&0x7fffffff,path+(name,))
        else:
            data_rva,size=struct.unpack_from('<II',blob,resource_base+target)
            resources[path+(name,)]=memoryview(blob)[address(data_rva):address(data_rva)+size]
walk(0)
def resource(kind,id):return next(value for path,value in resources.items() if path[:2]==(kind,id))
assert hashlib.sha256(resource(10,101)).hexdigest()==digest
assert bytes(resource(10,102))==(source/'Expand-And-Install.ps1').read_bytes()
assert b'requireAdministrator' in bytes(resource(24,1))
assert digest.encode('utf-16-le') in blob
imports=[];import_rva=struct.unpack_from('<I',blob,optional+112+8)[0];at=address(import_rva)
while any(blob[at:at+20]):
    name_rva=struct.unpack_from('<I',blob,at+12)[0];name_at=address(name_rva);end=blob.index(b'\0',name_at)
    imports.append(blob[name_at:end].decode('ascii'));at+=20
allowed={'kernel32.dll','user32.dll','gdi32.dll','shell32.dll','advapi32.dll','ole32.dll','comctl32.dll','bcrypt.dll','ucrtbase.dll','msvcrt.dll'}
assert all(name.lower() in allowed or name.lower().startswith('api-ms-win-crt-') for name in imports),imports
report={'version':'0.3.0','artifact':output.name,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'payloadSha256':digest,'machine':'AMD64','subsystem':'Windows GUI','adminManifest':True,'embeddedPayloadVerified':True,'embeddedScriptVerified':True,'aslr':True,'dep':True,'highEntropyVA':True,'imports':imports,'signed':False,'windowsExecuted':False,'sourceFingerprint':package['sourceFingerprint'],'setupSources':{file.name:hashlib.sha256(file.read_bytes()).hexdigest() for file in [source/'setup.c',source/'setup.manifest',source/'Expand-And-Install.ps1']},'toolchain':json.loads((toolchain.parent/'provenance.json').read_text())}
(ROOT/'artifacts/installer-verification.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'artifacts/ArcadeOT-windows-x64.exe.sha256').write_text(report['sha256']+'  '+output.name+'\n')
print(json.dumps(report,indent=2))
