"""Fingerprint source/build inputs used by the managed application checks."""
import hashlib
from pathlib import Path

def fingerprint(root: Path) -> str:
    inputs=[root/'Directory.Build.props',root/'global.json',root/'ArcadeOT.slnx']
    for base in ['src','tests/unit']:
        inputs += [p for p in (root/base).rglob('*') if p.is_file() and not {'bin','obj'}.intersection(p.relative_to(root).parts) and (p.suffix in {'.cs','.xaml','.csproj','.manifest'} or p.name=='packages.lock.json')]
    digest=hashlib.sha256()
    for file in sorted(inputs):
        digest.update(file.relative_to(root).as_posix().encode()+b'\0'+hashlib.sha256(file.read_bytes()).digest())
    return digest.hexdigest()
