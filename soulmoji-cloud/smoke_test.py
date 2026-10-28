# CI check for the Soulmoji AI image: makes all 12 moods from the benchmark's original photo and builds a
# grid to compare with docs/soulmoji-benchmark.jpg. Usage: python smoke_test.py <base url> <token> <out dir>
import base64, io, json, os, sys, time, urllib.request
from PIL import Image, ImageDraw

base, token, out = sys.argv[1].rstrip('/'), sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
MOODS = ['happy', 'laugh', 'love', 'sad', 'cry', 'angry', 'shocked', 'tired', 'cool', 'party', 'thinking', 'shy']

# wait for the models to load
for _ in range(120):
    try:
        with urllib.request.urlopen(f'{base}/health', timeout=5) as r:
            h = json.loads(r.read())
        if h.get('ready'): break
        if h.get('error'): sys.exit('AI failed to load: ' + h['error'])
    except Exception:  # noqa: BLE001
        pass
    time.sleep(3)
else:
    sys.exit('AI never became ready')

bench = Image.open('docs/soulmoji-benchmark.jpg').convert('RGB')
src = bench.crop((0, 0, 300, 300)).resize((600, 600), Image.LANCZOS)
buf = io.BytesIO(); src.save(buf, 'JPEG', quality=95)
payload = base64.b64encode(buf.getvalue()).decode()

tiles, times = [src], {}
for m in MOODS:
    req = urllib.request.Request(f'{base}/edit', data=json.dumps({'image': payload, 'mood': m}).encode(),
                                 headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=300) as r:
        j = json.loads(r.read())
    assert j.get('ok') and j.get('image'), f'{m}: {j}'
    times[m] = round(time.time() - t0, 1)
    im = Image.open(io.BytesIO(base64.b64decode(j['image']))).convert('RGB')
    im.save(f'{out}/{m}.jpg', quality=92); tiles.append(im)
    print(f'{m}: {times[m]} s', flush=True)

# a wrong token must be refused
bad = urllib.request.Request(f'{base}/edit', data=b'{}', headers={'Authorization': 'Bearer wrong'})
try:
    urllib.request.urlopen(bad, timeout=30); sys.exit('a wrong token was accepted')
except urllib.error.HTTPError as e:
    assert e.code == 401, e.code

T = 300
g = Image.new('RGB', (T * 4, (T + 22) * 4), (18, 16, 24)); d = ImageDraw.Draw(g)
for k, (name, im) in enumerate(zip(['original'] + MOODS, tiles)):
    x, y = (k % 4) * T, (k // 4) * (T + 22)
    g.paste(im.resize((T, T), Image.LANCZOS), (x, y)); d.text((x + 6, y + T + 5), name, fill=(230, 230, 230))
g.save(f'{out}/grid.jpg', quality=90)
json.dump(times, open(f'{out}/times.json', 'w'), indent=1)
print('average per mood:', round(sum(times.values()) / len(times), 1), 's')
print('SMOKE TEST OK')
