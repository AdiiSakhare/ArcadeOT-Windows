"""Portable integration checks. Constructed local SLMP frames; no PLC contacted."""
import argparse
import http.client
import json
import os
from pathlib import Path
import secrets
import socket
import sqlite3
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--dotnet', default='dotnet')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
service = root / 'src/ArcadeOT.Service/bin/Release/net10.0/ArcadeOT.Service.dll'
listener = socket.socket(); listener.bind(('127.0.0.1', 0)); listener.listen(); listener.settimeout(.2)
plc_port = listener.getsockname()[1]
with socket.socket() as reservation:
    reservation.bind(('127.0.0.1', 0)); api_port = reservation.getsockname()[1]
stop = threading.Event()
fixture_requests = []

def peer():
    while not stop.is_set():
        try:
            connection, _ = listener.accept()
        except socket.timeout:
            continue
        except OSError:
            return
        connection.settimeout(.5)
        with connection:
            while not stop.is_set():
                try:
                    request = b''
                    while len(request) < 21:
                        piece = connection.recv(21-len(request))
                        if not piece:
                            break
                        request += piece
                    if not request:
                        break
                    fixture_requests.append(request.hex())
                    assert request.hex() == '500000ffff03000c00100001040000640000a80100', request.hex()
                    # Fragmented response exercises actual socket reassembly.
                    connection.sendall(bytes.fromhex('d00000ffff03000400'))
                    connection.sendall(bytes.fromhex('0000d204'))
                except socket.timeout:
                    continue
                except OSError:
                    break

thread = threading.Thread(target=peer, daemon=True); thread.start()
result = {'kind':'local-fixture-only', 'checks':[]}
process = None
with tempfile.TemporaryDirectory(prefix='arcadeot-service-') as directory:
    data = Path(directory); key = secrets.token_urlsafe(36)
    (data/'api-token.txt').write_text(key)
    env = dict(os.environ, ARCADEOT_DATA_DIR=str(data), ARCADEOT_LOCAL_URL=f'http://127.0.0.1:{api_port}', DOTNET_CLI_TELEMETRY_OPTOUT='1')
    log = (data/'service.log').open('w')
    def launch():
        return subprocess.Popen([args.dotnet, str(service)], env=env, stdout=log, stderr=log)
    def api(path, body=None, auth=True, expected=200):
        request = urllib.request.Request(f'http://127.0.0.1:{api_port}/'+path,
            data=None if body is None else json.dumps(body).encode(),
            headers={'Content-Type':'application/json', **({'X-ArcadeOT-Key':key} if auth else {})})
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                assert response.status == expected
                return response.read()
        except urllib.error.HTTPError as error:
            assert error.code == expected, (path,error.code,error.read())
            return error.read()
    def wait_up():
        for _ in range(100):
            if process.poll() is not None:
                raise AssertionError('Service exited: '+(data/'service.log').read_text())
            try:
                api('health'); return
            except OSError:
                time.sleep(.1)
        raise AssertionError('Service startup timed out')
    try:
        process = launch(); wait_up()
        api('health', auth=False, expected=401)
        for body in [None, {'Version':99}, {'Version':2,'Secret':'invalid'}, {'Version':2,'Plcs':None}, {'Version':2,'Plcs':[None]}, {'Version':2,'Plcs':[{'Sensors':[None]}]}]:
            request_body = body if body is not None else {'Version':2,'SiteId':None}
            api('config', request_body, expected=400)
        connection = http.client.HTTPConnection('127.0.0.1', api_port, timeout=10)
        connection.request('POST', '/config', body=iter([b' ' * 1_000_001, b' ' * 1_000_001]), headers={'X-ArcadeOT-Key':key,'Content-Type':'application/json','Transfer-Encoding':'chunked'}, encode_chunked=True)
        oversized = connection.getresponse(); assert oversized.status == 413, oversized.status
        oversized.read(); connection.close()
        result['checks'].append('auth and strict invalid/null/unknown-field rejection; actual chunked-body limit')
        initial = json.loads(api('config'))
        config = {'Version':2,'SiteId':'fixture-site','Plcs':[
            {'Id':'fixture-plc','Name':'Local fixture','Model':'CONSTRUCTED TEST PEER','Host':'127.0.0.1','Port':plc_port,'Enabled':True,'PollMs':250,
             'Sensors':[{'Id':'temperature-1','Name':'Fixture temperature','Address':'D100','Type':'Int16','Scale':.1,'Terminal':'operator-T1','ModuleSku':'reference-only'}]},
            {'Id':'offline-plc','Name':'Disconnected fixture','Model':'CONSTRUCTED TEST PEER','Host':'127.0.0.1','Port':1,'Enabled':True,'PollMs':250,
             'Sensors':[{'Id':'bad-sensor','Name':'Disconnected','Address':'D100','Type':'Int16'}]}]}
        applied = json.loads(api('config', config)); assert applied['Revision'] != initial['Revision']
        for _ in range(100):
            rows = json.loads(api('live'))
            if len(rows) == 2 and next(r for r in rows if r['PlcId']=='fixture-plc')['Value'] == '123.4':
                break
            time.sleep(.1)
        assert len(rows)==2, rows
        good = next(r for r in rows if r['PlcId']=='fixture-plc'); bad = next(r for r in rows if r['PlcId']=='offline-plc')
        assert good['Quality']=='Good' and good['Raw']=='1234' and bad['Value']=='' and bad['Quality']=='BadCommunication', rows
        health=json.loads(api('health')); assert health['State']=='Degraded'; assert health['Buffer']['Pending']>=2
        assert b'123.4' in api('export.csv')
        history = json.loads(api('history?limit=1')); assert len(history)==1
        older = json.loads(api('history?limit=1&before='+str(history[0]['Sequence']))); assert len(older)==1 and older[0]['Sequence']<history[0]['Sequence']
        assert good['RawHex']=='D204'
        result['checks'].append('actual driver socket exchange, scaling/raw/quality, multi-PLC isolation, CSV and history cursor')
        assert json.loads(api('config'))['Plcs'][0]['Sensors'][0]['Terminal']=='operator-T1'
        config['Plcs'][0]['Sensors'].append(dict(config['Plcs'][0]['Sensors'][0]))
        api('config',config,expected=400)
        assert json.loads(api('config'))['Revision']==applied['Revision']
        result['checks'].append('physical I/O metadata retained; invalid apply preserves active revision')
        revisions=json.loads(api('config/history')); assert len(revisions)==1
        request=urllib.request.Request(f'http://127.0.0.1:{api_port}/config/restore/'+revisions[0]['Revision'],data=b'',headers={'X-ArcadeOT-Key':key},method='POST')
        with urllib.request.urlopen(request,timeout=5) as response: restored=json.loads(response.read())
        assert restored['Revision']!=applied['Revision']
        result['checks'].append('restore creates new configuration revision')
        process.terminate(); process.wait(timeout=15)
        with sqlite3.connect(data/'arcadeot.db') as db:
            n=db.execute('select count(*) from measurements').fetchone()[0]
            payloads=[json.loads(row[0]) for row in db.execute('select payload from measurements')]
            assert all(row['SourceAtUtc'] is None for row in payloads)
            assert any(row['Value']==123.4 for row in payloads)
            assert all(row['Value'] is None for row in payloads if row['PlcId']=='offline-plc')
        process=launch();wait_up();assert json.loads(api('health'))['Buffer']['Total']>=n
        assert len(json.loads(api('config/history')))==2
        result['checks'].append('process restart preserves SQLite records/config history and null source timestamps')
        assert fixture_requests
        result['status']='PASS'
    finally:
        stop.set()
        if process and process.poll() is None:
            process.terminate();process.wait(timeout=15)
        listener.close();thread.join(timeout=2);log.close()
        if result.get('status') != 'PASS':
            print((data/'service.log').read_text())
(root/'artifacts/service-integration.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
