import os,sys,json,time,socket,threading,subprocess,urllib.request,urllib.error,sqlite3
from pathlib import Path
root=Path.cwd();data=root/'work/service-check';data.mkdir(exist_ok=True);key='test-key-'+'x'*48;(data/'api-token.txt').write_text(key)
listener=socket.socket();listener.bind(('127.0.0.1',0));listener.listen();port=listener.getsockname()[1];stop=False

def peer():
 while not stop:
  try:
   c,_=listener.accept();c.settimeout(3)
   with c:
    while not stop:
     b=b''
     while len(b)<21:
      part=c.recv(21-len(b))
      if not part:break
      b+=part
     if len(b)!=21:break
     assert b.hex()=='500000ffff03000c00100001040000640000a80100',b.hex()
     c.sendall(bytes.fromhex('d00000ffff030004000000d204'))
  except (OSError,TimeoutError):pass
threading.Thread(target=peer,daemon=True).start()
env=dict(os.environ,ARCADEOT_DATA_DIR=str(data));log=(root/'work/service-test.log').open('w')
def start():return subprocess.Popen([str(root/'work/dotnet/dotnet'),str(root/'outputs/ArcadeOT-Handoff/app/src/ArcadeOT.Service/bin/Release/net10.0/ArcadeOT.Service.dll')],env=env,stdout=log,stderr=log)
def api(path,body=None,auth=True):
 req=urllib.request.Request('http://127.0.0.1:17845/'+path,data=None if body is None else json.dumps(body).encode(),headers={'Content-Type':'application/json',**({'X-ArcadeOT-Key':key} if auth else {})})
 with urllib.request.urlopen(req,timeout=3) as res:return res.read()
def wait_up():
 for _ in range(60):
  try:api('health');return
  except (OSError,urllib.error.URLError):time.sleep(.2)
 raise Exception('Service failed to start; inspect work/service-test.log')
p=start()
try:
 wait_up()
 try:api('health',auth=False);raise AssertionError('Missing token accepted')
 except urllib.error.HTTPError as e:assert e.code==401
 try:api('config',{'Version':99});raise AssertionError('Bad config accepted')
 except urllib.error.HTTPError as e:assert e.code==400
 config={'Version':1,'SiteId':'test-site','Plcs':[{'Id':'fixture-only','Model':'LOCAL PROTOCOL FIXTURE','Host':'127.0.0.1','Port':port,'Enabled':True,'PollMs':300,'Sensors':[{'Id':'t1','Address':'D100','Type':'Int16','Scale':.1}]}]}
 api('config',config)
 for _ in range(40):
  live=json.loads(api('live'))
  if live and live[0]['Quality']=='Good':break
  time.sleep(.2)
 assert live and live[0]['Value']=='123.4',live
 csv=api('export.csv');assert b'123.4' in csv
 health=json.loads(api('health'));assert health['buffer']['pending']>0,health
 p.terminate();p.wait(timeout=10)
 db=sqlite3.connect(data/'arcadeot.db');n=db.execute('select count(*) from measurements').fetchone()[0];m=json.loads(db.execute('select payload from measurements limit 1').fetchone()[0]);assert m['Value']==123.4 and m['SourceAtUtc'] is None;db.close()
 p=start();wait_up();assert json.loads(api('health'))['buffer']['total']>=n
 print('PASS: auth rejection, invalid config rejection, config apply, protocol fixture collection, scale/quality, CSV, SQLite durable rows, restart persistence. Windows/physical PLC NOT tested.')
finally:
 stop=True;p.terminate();p.wait(timeout=10);listener.close();log.close()
