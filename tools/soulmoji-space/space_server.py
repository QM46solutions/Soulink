# Web front for Soulmoji AI on Hugging Face Spaces. The Soulink server sends the selfie, gets the edited photo back.
#   GET  /health                                           -> {"ok": true, "ready": true}
#   POST /edit  {"image": base64 jpeg, "mood": "happy", "recipe"?: {...}}  (header: Authorization: Bearer <token>)
#               -> {"ok": true, "image": base64 jpeg, "ms": 4200}
#   POST /transcribe {"audio": base64 voice note, "ext": ".webm", "lang"?: "te"}  -> {"ok": true, "text": "..."}
#   POST /referee    {"system": "...", "prompt": "..."}                   -> {"ok": true, "text": "{...verdict json...}"}
#   POST /speak      {"text": "...", "lang": "te"}                      -> {"ok": true, "audio": base64, "ext": ".m4a", "durationMs": 2100}
import base64, hashlib, hmac, json, os, subprocess, tempfile, threading, time, traceback, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ.get('SOULMOJI_AI_TOKEN', '')
TMP = tempfile.gettempdir()
state = {'ai': None, 'error': None}

def load():  # the models take a minute to load; /health answers meanwhile
    try:
        import soulmoji_ai
        state['ai'] = soulmoji_ai
    except Exception as e:  # noqa: BLE001
        traceback.print_exc(); state['error'] = str(e)
threading.Thread(target=load, daemon=True).start()

# the Argue referee's model runs in Ollama next to us
try:
    subprocess.Popen(['ollama', 'serve'], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
except Exception as e:  # noqa: BLE001
    print('ollama did not start:', e, flush=True)
REFEREE_MODEL = os.environ.get('REFEREE_MODEL', 'llama3.2:3b')
referee_lock = threading.Lock()

def referee(system, prompt):
    body = json.dumps({'model': REFEREE_MODEL, 'stream': False, 'format': 'json', 'options': {'temperature': 0.3, 'num_ctx': 4096},
                       'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': prompt}]}).encode()
    req = urllib.request.Request('http://127.0.0.1:11434/api/chat', data=body, headers={'Content-Type': 'application/json'})
    with referee_lock, urllib.request.urlopen(req, timeout=170) as r:
        return json.loads(r.read()).get('message', {}).get('content', '')

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def reply(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path in ('/', '/health'):
            return self.reply(200, {'ok': True, 'ready': state['ai'] is not None, 'error': state['error']})
        self.reply(404, {'ok': False})
    def do_POST(self):
        if self.path not in ('/edit', '/transcribe', '/speak', '/referee'): return self.reply(404, {'ok': False})
        auth = self.headers.get('Authorization', '')
        if not TOKEN or not hmac.compare_digest(auth, f'Bearer {TOKEN}'):
            return self.reply(401, {'ok': False, 'error': 'not allowed'})
        if self.path == '/referee':
            try:
                req = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
                return self.reply(200, {'ok': True, 'text': referee(req['system'], req['prompt'])})
            except Exception as e:  # noqa: BLE001
                traceback.print_exc(); return self.reply(503, {'ok': False, 'error': str(e)})
        ai = state['ai']
        if ai is None: return self.reply(503, {'ok': False, 'error': state['error'] or 'warming up'})
        try:
            n = int(self.headers.get('Content-Length', 0))
            if n > 12 * 1024 * 1024: return self.reply(413, {'ok': False, 'error': 'photo too big'})
            req = json.loads(self.rfile.read(n) or b'{}')
            if self.path == '/transcribe':
                ext = req.get('ext') if str(req.get('ext', '')).startswith('.') else '.webm'
                src = os.path.join(TMP, f'in_{time.time_ns()}{ext[:6]}')
                with open(src, 'wb') as f: f.write(base64.b64decode(req['audio']))
                try:
                    with ai.voice_lock: text = ai.transcribe(src, req.get('lang'))
                finally: os.remove(src)
                return self.reply(200, {'ok': True, 'text': text})
            if self.path == '/speak':
                out = os.path.join(TMP, f'voice_{time.time_ns()}.m4a')
                with ai.voice_lock: path, ms = ai.speak(req['text'][:2000], req['lang'], out)
                with open(path, 'rb') as f: audio = base64.b64encode(f.read()).decode()
                os.remove(path)
                return self.reply(200, {'ok': True, 'audio': audio, 'ext': os.path.splitext(path)[1], 'durationMs': ms})
            raw = base64.b64decode(req['image'])
            # same selfie -> same file name, so its face features are worked out only once
            src = os.path.join(TMP, f'src_{hashlib.sha1(raw).hexdigest()}.jpg')
            if not os.path.exists(src):
                with open(src, 'wb') as f: f.write(raw)
            out = os.path.join(TMP, f'out_{time.time_ns()}.jpg')
            t0 = time.time()
            with ai.lock:
                ai.edit(src, out, req.get('mood', 'happy'), req.get('recipe'))
            with open(out, 'rb') as f: img = base64.b64encode(f.read()).decode()
            os.remove(out)
            self.reply(200, {'ok': True, 'image': img, 'ms': int((time.time() - t0) * 1000)})
        except Exception as e:  # noqa: BLE001
            traceback.print_exc(); self.reply(500, {'ok': False, 'error': str(e)})

if __name__ == '__main__':
    print('Soulmoji AI web on :7860', flush=True)
    ThreadingHTTPServer(('0.0.0.0', 7860), H).serve_forever()
