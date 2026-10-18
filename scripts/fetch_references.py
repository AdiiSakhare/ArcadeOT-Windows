"""Download official reference copies for local engineering review; never execute them."""
import concurrent.futures
import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
urls = json.loads((ROOT / 'references/download-urls.json').read_text())
out = ROOT / 'references/manuals'
out.mkdir(parents=True, exist_ok=True)

def fetch(item):
    name, url = item
    row = {'file': name, 'url': url}
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read(40_000_001)
        if len(data) > 40_000_000 or not data.startswith(b'%PDF-'):
            raise ValueError('Expected PDF smaller than 40 MB')
        (out / name).write_bytes(data)
        row.update(status='downloaded', bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
    except Exception as error:
        row.update(status='unavailable', error=str(error))
    return row

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(fetch, urls.items()))
(ROOT / 'references/download-status.json').write_text(json.dumps(results, indent=2) + '\n')
for row in results:
    print(row['file'], row['status'], row.get('bytes', row.get('error')))
