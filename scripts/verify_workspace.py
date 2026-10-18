"""Verify legacy preservation and basic workspace/document integrity. No PLC traffic."""
from pathlib import Path
import hashlib
import json
import re
import sqlite3
import struct

ROOT = Path(__file__).resolve().parents[1]
issues = []
manifest_results = []
for folder in ['legacy-release', 'legacy-handoff']:
    base = ROOT / 'archive' / folder
    count = 0
    for line in (base / 'SHA256SUMS.txt').read_text().splitlines():
        digest, name = line.split(None, 1)
        file = base / name.lstrip('*')
        if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != digest:
            issues.append('Legacy checksum failure: ' + str(file.relative_to(ROOT)))
        count += 1
    manifest_results.append({'package': folder, 'entries': count})

inventory = json.loads((ROOT / 'research/original-file-inventory.json').read_text())
for row in inventory:
    destination = row['originalPath'].replace('ArcadeOT-Handoff/', 'archive/legacy-handoff/', 1) if row['originalPath'].startswith('ArcadeOT-Handoff/') else row['originalPath'].replace('ArcadeOT/', 'archive/legacy-release/', 1)
    file = ROOT / destination
    if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != row['sha256']:
        issues.append('Original not preserved: ' + destination)

json_files = [file for file in ROOT.rglob('*.json') if file.is_file() and 'artifacts' not in file.relative_to(ROOT).parts]
json_files += [file for file in (ROOT/'artifacts').glob('*.json') if file.is_file()]
for file in json_files:
    json.loads(file.read_text(encoding="utf-8-sig"))

for file in [ROOT/'archive/legacy-release/ui/arcadeOT.exe', ROOT/'archive/legacy-release/service/ArcadeOT.Service.exe']:
    data = file.read_bytes()
    offset = struct.unpack_from('<I', data, 60)[0]
    if data[:2] != b'MZ' or data[offset:offset+4] != b'PE\x00\x00' or struct.unpack_from('<H', data, offset+4)[0] != 0x8664:
        issues.append('Unexpected EXE format: ' + str(file))

# Check new Markdown links; archived docs are unchanged historical artifacts.
links_checked = 0
for file in ROOT.rglob('*.md'):
    if any(part in {'archive', 'artifacts', 'bin', 'obj'} for part in file.relative_to(ROOT).parts):
        continue
    for target in re.findall(r'\]\(([^)]+)\)', file.read_text()):
        if target.startswith(('https:', 'http:', '#')):
            continue
        target = target.split('#', 1)[0]
        if not (file.parent / target).exists():
            issues.append('Broken link in ' + str(file.relative_to(ROOT)) + ': ' + target)
        links_checked += 1

with sqlite3.connect(':memory:') as db:
    db.executescript((ROOT/'schemas/sqlite.sql').read_text())

report = {'date':'2026-10-18','status':'PASS' if not issues else 'FAIL','originalFilesPreserved':len(inventory),'legacyManifests':manifest_results,'jsonFilesParsed':len(json_files),'newLocalMarkdownLinksChecked':links_checked,'windowsExeHeaders':'AMD64 PE','sqliteBaselineDdl':'executed in memory','issues':issues,'notRun':['Windows UI/installer/service execution','physical PLC validation','cloud deployment']}
(ROOT/'research/workspace-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
raise SystemExit(1 if issues else 0)
