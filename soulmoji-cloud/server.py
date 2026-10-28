# Soulmoji AI in the cloud (Azure Container Apps). Only the Soulink server talks to it.
#   GET  /health  -> {"ok": true, "ready": true|false}
#   POST /edit    {"image": base64 photo, "mood": "laugh", "recipe"?: {...}}   header: Authorization: Bearer <token>
#                 -> {"ok": true, "image": base64 jpeg, "ms": 4200}
# The expression work is soulmoji_ai.py, the very same file the laptop runs, so both give identical results.
import base64, hashlib, hmac, json, os, tempfile, threading, time, traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ.get('SOULMOJI_AI_TOKEN', '')
PORT = int(os.environ.get('PORT', '7860'))
TMP = tempfile.gettempdir()
state = {'ai': None, 'error': None}


def load():  # loading the models takes ~20-40 s; /health answers meanwhile
    try:
        import soulmoji_ai
        state['ai'] = soulmoji_ai
        print('Soulmoji AI ready', flush=True)
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        state['error'] = str(e)


threading.Thread(target=load, daemon=True).start()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path in ('/', '/health'):
            return self.reply(200, {'ok': True, 'ready': state['ai'] is not None, 'error': state['error']})
        self.reply(404, {'ok': False})

    def do_POST(self):
        if self.path != '/edit':
            return self.reply(404, {'ok': False})
        if not TOKEN or not hmac.compare_digest(self.headers.get('Authorization', ''), f'Bearer {TOKEN}'):
            return self.reply(401, {'ok': False, 'error': 'not allowed'})
        # still loading: wait for it (up to 2 minutes) instead of failing the first request after a cold start
        until = time.time() + 120
        while state['ai'] is None and state['error'] is None and time.time() < until:
            time.sleep(0.5)
        ai = state['ai']
        if ai is None:
            return self.reply(503, {'ok': False, 'error': state['error'] or 'warming up'})
        try:
            n = int(self.headers.get('Content-Length', 0))
            if n > 12 * 1024 * 1024:
                return self.reply(413, {'ok': False, 'error': 'photo too big'})
            req = json.loads(self.rfile.read(n) or b'{}')
            raw = base64.b64decode(req['image'])
            # same selfie -> same file name, so its face is analysed only once for all 12 moods
            src = os.path.join(TMP, f'src_{hashlib.sha1(raw).hexdigest()}.jpg')
            if not os.path.exists(src):
                with open(src, 'wb') as f:
                    f.write(raw)
            out = os.path.join(TMP, f'out_{time.time_ns()}.jpg')
            t0 = time.time()
            with ai.lock:
                ai.edit(src, out, req.get('mood', 'happy'), req.get('recipe'))
            with open(out, 'rb') as f:
                img = base64.b64encode(f.read()).decode()
            os.remove(out)
            self.reply(200, {'ok': True, 'image': img, 'ms': int((time.time() - t0) * 1000)})
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            self.reply(500, {'ok': False, 'error': str(e)})


if __name__ == '__main__':
    print(f'Soulmoji AI web on :{PORT}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', PORT), H).serve_forever()
