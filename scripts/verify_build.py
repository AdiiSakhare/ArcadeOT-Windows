"""Build and verify the preview with an installed .NET SDK; no physical PLC needed."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import shutil
from build_fingerprint import fingerprint

parser = argparse.ArgumentParser()
parser.add_argument('--dotnet', default='dotnet')
parser.add_argument('--skip-build', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
artifacts = root/'artifacts'; artifacts.mkdir(exist_ok=True)
env = dict(os.environ, DOTNET_CLI_HOME=str(artifacts/'dotnet-home'), DOTNET_CLI_TELEMETRY_OPTOUT='1', DOTNET_CLI_WORKLOAD_UPDATE_NOTIFY_DISABLE='true')
commands = []
if not args.skip_build:
    commands.append(('build', [args.dotnet,'build','ArcadeOT.slnx','-c','Release','--no-restore','-m:1','--disable-build-servers']))
commands += [
    ('core-checks',[args.dotnet,'tests/unit/ArcadeOT.Checks/bin/Release/net10.0/ArcadeOT.Checks.dll']),
    ('service-integration',[sys.executable,'tests/integration/service_integration.py','--dotnet',args.dotnet]),
    ('package-audit',[args.dotnet,'list','ArcadeOT.slnx','package','--vulnerable','--include-transitive','--format','json'])]
powershell = shutil.which('pwsh') or (str(artifacts/'powershell/pwsh') if (artifacts/'powershell/pwsh').exists() else None)
if powershell:
    commands.insert(-1, ('installer-checks',[powershell,'-NoLogo','-NoProfile','-File','tests/integration/Installer-Checks.ps1']))
results = []
for name, command in commands:
    result = subprocess.run(command,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    (artifacts/(name+'.log')).write_text(result.stdout)
    if name == 'package-audit' and result.returncode == 0:
        audit=json.loads(result.stdout)
        (artifacts/'package-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
        if audit.get('logs') or any(package.get('vulnerabilities') for project in audit.get('projects',[]) for framework in project.get('frameworks',[]) for category in ['topLevelPackages','transitivePackages'] for package in framework.get(category,[])):
            raise SystemExit('Dependency audit contains errors or vulnerabilities; inspect report.')
    results.append({'check':name,'exitCode':result.returncode})
    print(name, 'PASS' if result.returncode==0 else 'FAIL',flush=True)
    print(result.stdout[-5000:],flush=True)
    if result.returncode:
        (artifacts/'build-verification.json').write_text(json.dumps({'status':'FAIL','checks':results},indent=2)+'\n')
        raise SystemExit(result.returncode)
(artifacts/'build-verification.json').write_text(json.dumps({'status':'PASS','sourceFingerprint':fingerprint(root),'checks':results,'notRun':['Windows desktop interaction','PowerShell installer/service registration','Windows boot before login','physical PLC','hosted cloud','signing']},indent=2)+'\n')
