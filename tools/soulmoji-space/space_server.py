# Web front for Soulmoji AI on Hugging Face Spaces. The Soulink server sends the selfie, gets the edited photo back.
#   GET  /health                                           -> {"ok": true, "ready": true}
#   POST /edit  {"image": base64 jpeg, "mood": "happy", "recipe"?: {...}}  (header: Authorization: Bearer <token>)
#               -> {"ok": true, "image": base64 jpeg, "ms": 4200}
import base64, hashlib, hmac, json, os, tempfile, threading, time, traceback
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
        if self.path != '/edit': return self.reply(404, {'ok': False})
        auth = self.headers.get('Authorization', '')
        if not TOKEN or not hmac.compare_digest(auth, f'Bearer {TOKEN}'):
            return self.reply(401, {'ok': False, 'error': 'not allowed'})
        ai = state['ai']
        if ai is None: return self.reply(503, {'ok': False, 'error': state['error'] or 'warming up'})
        try:
            n = int(self.headers.get('Content-Length', 0))
            if n > 12 * 1024 * 1024: return self.reply(413, {'ok': False, 'error': 'photo too big'})
            req = json.loads(self.rfile.read(n) or b'{}')
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
