# Soulmoji AI: changes the facial expression on a real photo with LivePortrait (open source, MIT code by
# Kuaishou / KwaiVGI, https://github.com/KwaiVGI/LivePortrait). Runs only on this laptop.
# The face is re-rendered by the model and pasted back into the ORIGINAL photo, so hair, background and
# resolution stay untouched; only the expression changes.
#
# Started automatically by the Soulink server (server/src/services/soulmojiAi.js). Local only: 127.0.0.1:8211
#   GET  /health                                  -> {"ok": true, "device": "cpu"}
#   POST /edit {"src": path, "out": path, "mood": "happy"}  -> {"ok": true, "ms": 4200}
#
# The expression maths below (update_delta_*) is taken from LivePortrait's src/gradio_pipeline.py (MIT).
import json
import os
import sys
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock

HERE = os.path.dirname(os.path.abspath(__file__))
LP = os.path.join(HERE, 'LivePortrait')
sys.path.insert(0, LP)

import cv2  # noqa: E402
import numpy as np  # noqa: E402
import torch  # noqa: E402

from src.config.inference_config import InferenceConfig  # noqa: E402
from src.config.crop_config import CropConfig  # noqa: E402
from src.live_portrait_wrapper import LivePortraitWrapper  # noqa: E402
from src.utils.cropper import Cropper  # noqa: E402
from src.utils.crop import prepare_paste_back, paste_back  # noqa: E402
from src.utils.camera import get_rotation_matrix  # noqa: E402
from src.utils.retargeting_utils import calc_eye_close_ratio, calc_lip_close_ratio  # noqa: E402

PORT = int(os.environ.get('SOULMOJI_AI_PORT', '8211'))
GPU = torch.cuda.is_available()
torch.set_num_threads(max(1, (os.cpu_count() or 2)))

# ---- the expression controls (same as LivePortrait's "retargeting" sliders) ----
def d_smile(v, d):
    d[0, 20, 1] += v * -0.01; d[0, 14, 1] += v * -0.02; d[0, 17, 1] += v * 0.0065; d[0, 17, 2] += v * 0.003
    d[0, 13, 1] += v * -0.00275; d[0, 16, 1] += v * -0.00275; d[0, 3, 1] += v * -0.0035; d[0, 7, 1] += v * -0.0035
def d_wink(v, d):
    d[0, 11, 1] += v * 0.001; d[0, 13, 1] += v * -0.0003; d[0, 17, 0] += v * 0.0003; d[0, 17, 1] += v * 0.0003; d[0, 3, 1] += v * -0.0003
def d_eyebrow(v, d):
    if v > 0:
        d[0, 1, 1] += v * 0.001; d[0, 2, 1] += v * -0.001
    else:
        d[0, 1, 0] += v * -0.001; d[0, 2, 0] += v * 0.001; d[0, 1, 1] += v * 0.0003; d[0, 2, 1] += v * -0.0003
def d_gaze(x, y, d):
    if x > 0:
        d[0, 11, 0] += x * 0.0007; d[0, 15, 0] += x * 0.001
    else:
        d[0, 11, 0] += x * 0.001; d[0, 15, 0] += x * 0.0007
    d[0, 11, 1] += y * -0.001; d[0, 15, 1] += y * -0.001
    blink = -y / 2.
    d[0, 11, 1] += blink * -0.001; d[0, 13, 1] += blink * 0.0003; d[0, 15, 1] += blink * -0.001; d[0, 16, 1] += blink * 0.0003
def d_pout(v, d): d[0, 19, 0] += v
def d_purse(v, d):
    d[0, 14, 1] += v * 0.001; d[0, 3, 1] += v * -0.0005; d[0, 7, 1] += v * -0.0005; d[0, 17, 2] += v * -0.0005
def d_grin(v, d):
    d[0, 20, 2] += v * -0.001; d[0, 20, 1] += v * -0.001; d[0, 14, 1] += v * -0.001
def d_open(v, d):
    d[0, 19, 1] += v * 0.001; d[0, 19, 2] += v * 0.0001; d[0, 17, 1] += v * -0.0001

# Mood recipes (slider values within LivePortrait's own ranges). eyes: target eyes-open ratio relative
# to the photo (1 = unchanged, <1 closes, >1 opens).
MOODS = {
    # Smiling moods keep the lips closed ('lips': 0 and 'open' < 0): showing teeth looks messy.
    'happy':    {'smile': 0.9, 'eyebrow': 3, 'eyes': 0.85, 'lips': 0.0, 'open': -25},
    'laugh':    {'smile': 1.2, 'eyebrow': 10, 'eyes': 0.3, 'lips': 0.0, 'open': -30, 'tears': 'happy'},  # laughing so hard you cry
    'love':     {'smile': 0.7, 'eyebrow': 5, 'eyes': 0.75, 'lips': 0.0, 'open': -20, 'roll': 3},
    'sad':      {'smile': -0.3, 'eyebrow': 14, 'purse': 6, 'gaze': (0, -10), 'lips': 0.0},
    'cry':      {'smile': -0.3, 'eyebrow': 18, 'purse': 8, 'eyes': 0.55, 'gaze': (0, -8), 'lips': 0.0, 'tears': 'sad'},
    'angry':    {'smile': -0.25, 'eyebrow': -26, 'purse': -6, 'eyes': 0.75, 'lips': 0.0},
    'shocked':  {'eyebrow': 28, 'eyes': 1.35, 'open': 40, 'purse': 16},  # small round "O", lips over the teeth
    'tired':    {'smile': -0.1, 'eyes': 0.3, 'gaze': (0, -12), 'lips': 0.0, 'roll': -4},
    'cool':     {'smile': 0.5, 'wink': 22, 'lips': 0.0, 'open': -20},
    'party':    {'smile': 1.0, 'eyebrow': 8, 'eyes': 0.55, 'lips': 0.0, 'open': -25, 'roll': -4},
    'thinking': {'eyebrow': 14, 'pout': 0.04, 'gaze': (14, 16), 'lips': 0.0, 'roll': 5},
    'shy':      {'smile': 0.45, 'gaze': (0, -14), 'eyes': 0.8, 'lips': 0.0, 'open': -15, 'pitch': 5},
}

# Recipes can be tuned without restarting: moods.json (same keys) overrides the built-in table.
MOODS_FILE = os.path.join(HERE, 'moods.json')
def recipes():
    try:
        with open(MOODS_FILE, 'r', encoding='utf-8') as f:
            return {**MOODS, **json.load(f)}
    except Exception:  # noqa: BLE001
        return MOODS
VERSION = str(int(os.path.getmtime(__file__)))

infer = InferenceConfig()
infer.flag_force_cpu = not GPU
infer.flag_use_half_precision = GPU
crop = CropConfig()
crop.flag_force_cpu = not GPU
wrapper = LivePortraitWrapper(inference_cfg=infer)
cropper = Cropper(crop_cfg=crop, flag_force_cpu=not GPU, image_type='human_face')
lock = Lock()
tr_lock = Lock()

# ---------- chat translator: Meta's NLLB-200 (distilled 600M), loaded on first use ----------
TR_DIR = os.path.join(HERE, 'models', 'nllb-200-distilled-600M')
NLLB = {'en': 'eng_Latn', 'hi': 'hin_Deva', 'te': 'tel_Telu', 'bn': 'ben_Beng'}
_tr = None

def translator():
    global _tr
    if _tr is None:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        tok = AutoTokenizer.from_pretrained(TR_DIR)
        model = AutoModelForSeq2SeqLM.from_pretrained(TR_DIR).eval()
        if GPU:
            model = model.to('cuda')
        _tr = (tok, model)
    return _tr

@torch.no_grad()
def translate(text, src, tgt):
    tok, model = translator()
    tok.src_lang = NLLB[src]
    out_parts = []
    # translate line by line so long messages and line breaks survive
    import re
    for line in text.split('\n'):
        if not line.strip():
            out_parts.append(line); continue
        # NLLB tends to drop a sentence when given several at once, so translate each sentence on its own
        sentences = []
        for x in [x for x in re.split(r'(?<=[.!?\u0964])\s+', line.strip()) if x]:
            # very short bits ("Hi!", "Ok.") make NLLB repeat itself, so keep them with the next sentence
            if sentences and len(sentences[-1].split()) < 3:
                sentences[-1] = sentences[-1] + ' ' + x
            else:
                sentences.append(x)
        enc = tok(sentences, return_tensors='pt', padding=True, truncation=True, max_length=256)
        if GPU:
            enc = {k: v.to('cuda') for k, v in enc.items()}
        gen = model.generate(**enc, forced_bos_token_id=tok.convert_tokens_to_ids(NLLB[tgt]), max_new_tokens=256, num_beams=3)
        joined = ' '.join(tok.batch_decode(gen, skip_special_tokens=True))
        out_parts.append(re.sub(r'(\S.{0,40}?[!?.,\u0964])(\s+\1)+', r'\1', joined))  # drop phrases the model repeated
    return '\n'.join(out_parts)

# ---------- voice translator: Whisper small (speech -> text, MIT) + Meta MMS-TTS (text -> speech) ----------
ASR_DIR = os.path.join(HERE, 'models', 'whisper-small')
TTS_CODES = {'en': 'eng', 'hi': 'hin', 'te': 'tel', 'bn': 'ben'}
TTS_DIR = lambda lang: os.path.join(HERE, 'models', f'mms-tts-{TTS_CODES[lang]}')
WHISPER_LANG = {'en': 'english', 'hi': 'hindi', 'te': 'telugu', 'bn': 'bengali'}
_asr = None
_tts = {}
voice_lock = Lock()

def voice_installed():
    return os.path.exists(os.path.join(ASR_DIR, 'config.json')) and all(os.path.exists(os.path.join(TTS_DIR(l), 'config.json')) for l in TTS_CODES)

def load_audio(path):
    """Any voice note (webm/opus from the browser, m4a from phones) -> 16 kHz mono float32."""
    import av
    chunks = []
    with av.open(path) as c:
        res = av.AudioResampler(format='flt', layout='mono', rate=16000)
        for frame in c.decode(audio=0):
            for f in res.resample(frame):
                chunks.append(f.to_ndarray().reshape(-1))
        for f in res.resample(None):
            chunks.append(f.to_ndarray().reshape(-1))
    return np.concatenate(chunks).astype(np.float32) if chunks else np.zeros(1600, np.float32)

def asr():
    global _asr
    if _asr is None:
        from transformers import pipeline
        _asr = pipeline('automatic-speech-recognition', model=ASR_DIR, device=0 if GPU else -1, chunk_length_s=30)
    return _asr

@torch.no_grad()
def transcribe(path, lang=None):
    audio = load_audio(path)[: 16000 * 180]  # up to 3 minutes
    kw = {'task': 'transcribe'}
    if lang in WHISPER_LANG:
        kw['language'] = WHISPER_LANG[lang]
    out = asr()({'raw': audio, 'sampling_rate': 16000}, generate_kwargs=kw)
    return (out.get('text') or '').strip()

def tts(lang):
    if lang not in _tts:
        from transformers import AutoTokenizer, VitsModel
        d = TTS_DIR(lang)
        _tts[lang] = (AutoTokenizer.from_pretrained(d), VitsModel.from_pretrained(d).eval())
    return _tts[lang]

def write_audio(pcm, rate, out):
    """AAC in .m4a (small, plays everywhere). Falls back to .wav if the encoder is missing. Returns the real path."""
    pcm16 = (np.clip(pcm, -1, 1) * 32767).astype(np.int16)
    try:
        import av
        with av.open(out, 'w', format='mp4') as c:
            st = c.add_stream('aac', rate=rate)
            try:
                st.layout = 'mono'
            except Exception:  # noqa: BLE001
                pass
            frame = av.AudioFrame.from_ndarray(pcm16.reshape(1, -1), format='s16', layout='mono')
            frame.sample_rate = rate
            for pk in st.encode(frame):
                c.mux(pk)
            for pk in st.encode(None):
                c.mux(pk)
        return out
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        import wave
        out = os.path.splitext(out)[0] + '.wav'
        with wave.open(out, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm16.tobytes())
        return out

@torch.no_grad()
def speak(text, lang, out):
    import re
    tok, model = tts(lang)
    rate = model.config.sampling_rate
    parts = [x for x in re.split(r'(?<=[.!?।,])\s+', text.strip()) if x.strip()] or [text]
    pieces = []
    for part in parts:
        t = part
        if getattr(tok, 'is_uroman', False):  # some MMS voices read romanised text
            import uroman
            t = uroman.Uroman().romanize_string(t)
        enc = tok(t, return_tensors='pt')
        if enc['input_ids'].shape[-1] == 0:
            continue
        torch.manual_seed(7)  # same voice every time
        wav = model(**enc).waveform[0].cpu().numpy()
        pieces += [wav, np.zeros(int(rate * 0.18), np.float32)]
    pcm = np.concatenate(pieces) if pieces else np.zeros(rate // 2, np.float32)
    path = write_audio(pcm, rate, out)
    return path, int(len(pcm) * 1000 / rate)

cache = {}  # source path + mtime -> prepared source (face features are computed once per selfie)


@torch.no_grad()
def prepare(src):
    key = (src, os.path.getmtime(src))
    if key in cache:
        return cache[key]
    img_bgr = cv2.imread(src, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise ValueError('cannot read image')
    h, w = img_bgr.shape[:2]
    img_rgb = np.ascontiguousarray(img_bgr[:, :, ::-1][: h - h % 2, : w - w % 2])
    info = cropper.crop_source_image(img_rgb, crop)
    if info is None:
        raise ValueError('no face found')
    I_s = wrapper.prepare_source(info['img_crop_256x256'])
    lmk = info['lmk_crop']
    kp = wrapper.get_kp_info(I_s)
    R_s = get_rotation_matrix(kp['pitch'], kp['yaw'], kp['roll'])
    prep = {
        'img': img_rgb, 'lmk': lmk, 'kp': kp, 'R_s': R_s,
        'f_s': wrapper.extract_feature_3d(I_s), 'x_s': wrapper.transform_keypoint(kp),
        'M': info['M_c2o'], 'mask': prepare_paste_back(infer.mask_crop, info['M_c2o'], dsize=(img_rgb.shape[1], img_rgb.shape[0])),
        'eye': float(calc_eye_close_ratio(lmk[None]).mean()), 'lip': float(calc_lip_close_ratio(lmk[None])[0][0]),
    }
    cache.clear(); cache[key] = prep
    return prep


@torch.no_grad()
def edit(src, out, mood, recipe=None):
    p = prepare(src)
    r = recipe or recipes().get(mood, MOODS['happy'])
    dev = wrapper.device
    x_c_s = p['kp']['kp'].to(dev)
    delta = p['kp']['exp'].to(dev).clone()
    scale = p['kp']['scale'].to(dev)
    t = p['kp']['t'].to(dev)
    R = p['R_s'].to(dev)
    if any(k in r for k in ('pitch', 'yaw', 'roll')):  # small head tilt (laughing throws the head back a little)
        kp = p['kp']
        R_d = get_rotation_matrix(kp['pitch'] + r.get('pitch', 0), kp['yaw'] + r.get('yaw', 0), kp['roll'] + r.get('roll', 0)).to(dev)
        R = (R_d @ R.permute(0, 2, 1)) @ R
    if 'smile' in r: d_smile(r['smile'], delta)
    if 'wink' in r: d_wink(r['wink'], delta)
    if 'eyebrow' in r: d_eyebrow(r['eyebrow'], delta)
    if 'gaze' in r: d_gaze(r['gaze'][0], r['gaze'][1], delta)
    if 'pout' in r: d_pout(r['pout'], delta)
    if 'purse' in r: d_purse(r['purse'], delta)
    if 'grin' in r: d_grin(r['grin'], delta)
    if 'open' in r: d_open(r['open'], delta)
    x_s = p['x_s'].to(dev)
    x_d = scale * (x_c_s @ R + delta) + t
    if 'eyes' in r and abs(r['eyes'] - 1) > 1e-3:
        ratio = min(0.8, max(0.0, p['eye'] * r['eyes']))
        x_d = x_d + wrapper.retarget_eye(x_s, wrapper.calc_combined_eye_ratio([[ratio]], p['lmk']))
    if 'lips' in r:  # target lip-open ratio: 0 keeps the mouth closed, so no teeth show
        x_d = x_d + wrapper.retarget_lip(x_s, wrapper.calc_combined_lip_ratio([[float(r['lips'])]], p['lmk']))
    x_d = wrapper.stitching(x_s, x_d)
    face = wrapper.parse_output(wrapper.warp_decode(p['f_s'].to(dev), x_s, x_d)['out'])[0]
    full = paste_back(face, p['M'], p['img'], p['mask'])
    if r.get('tears'):  # LivePortrait's landmarks are in the original photo's coordinates
        full = add_tears(full, p['lmk'], r['tears'])
    cv2.imwrite(out, full[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 95])


def add_tears(face, lmk, kind):
    """Glossy tears painted on the photo (LivePortrait landmarks are in photo coordinates).
    'happy' = laughing-so-hard tears: a plump drop squeezing out of each outer eye corner with a short wet trail
    and a smaller drop below. 'sad' = a tear track running down each cheek ending in a drop.
    203-point landmarks: left eye 0-23 (corners 0 / 12, bottom 18), right eye 24-47 (corners 24 / 36, bottom 42)."""
    img = face.astype(np.float32)
    h, w = img.shape[:2]
    centre = lmk[0:48].mean(axis=0)
    eye_w = float((np.linalg.norm(lmk[0] - lmk[12]) + np.linalg.norm(lmk[24] - lmk[36])) / 2)
    body = np.zeros((h, w), np.float32)   # the water itself
    edge = np.zeros((h, w), np.float32)   # darker rim (light bending at the drop's edge)
    shine = np.zeros((h, w), np.float32)  # bright highlight
    P = lambda v: (int(round(v[0])), int(round(v[1])))  # noqa: E731

    def drop(c, r):
        tip = c + np.array([0, -r * 1.55])
        poly = cv2.ellipse2Poly(P(c), (int(r * 0.82), int(r)), 0, 0, 360, 10)
        shape = np.vstack([poly[poly[:, 1] >= c[1] - r * 0.2], [P(c + [r * 0.6, -r * 0.6]), P(tip), P(c + [-r * 0.6, -r * 0.6])]])
        hull = cv2.convexHull(shape.astype(np.int32))
        cv2.fillConvexPoly(body, hull, 0.85, cv2.LINE_AA)
        cv2.polylines(edge, [hull], True, 0.6, max(1, int(r * 0.14)), cv2.LINE_AA)
        cv2.ellipse(shine, P(c + [-r * 0.32, -r * 0.18]), (max(1, int(r * 0.2)), max(1, int(r * 0.34))), -20, 0, 360, 0.95, -1, cv2.LINE_AA)
        cv2.circle(shine, P(c + [r * 0.3, r * 0.4]), max(1, int(r * 0.09)), 0.6, -1, cv2.LINE_AA)

    for a, b, bottom in ((0, 12, 18), (24, 36, 42)):
        ia, ib = (a, b) if np.linalg.norm(lmk[a] - centre) > np.linalg.norm(lmk[b] - centre) else (b, a)
        outer, inner = lmk[ia].astype(np.float32), lmk[ib].astype(np.float32)
        out_dir = (outer - inner) / (np.linalg.norm(outer - inner) + 1e-6)
        if kind == 'happy':
            c1 = outer + out_dir * eye_w * 0.1 + np.array([0, eye_w * 0.34])
            trail = np.array([P(outer + [0, eye_w * 0.06]), P(c1 + [0, -eye_w * 0.2])], np.int32)
            cv2.polylines(body, [trail], False, 0.7, max(2, int(eye_w * 0.08)), cv2.LINE_AA)
            drop(c1, eye_w * 0.17)
            drop(c1 + out_dir * eye_w * 0.08 + np.array([0, eye_w * 0.5]), eye_w * 0.11)
        else:
            low = lmk[bottom].astype(np.float32)
            start = low * 0.45 + outer * 0.55 + np.array([0, eye_w * 0.1])
            end = start + np.array([out_dir[0] * eye_w * 0.08, eye_w * 1.1])
            track = np.array([P(start), P(start + np.array([out_dir[0] * eye_w * 0.03, eye_w * 0.55])), P(end)], np.int32)
            cv2.polylines(body, [track], False, 0.55, max(3, int(eye_w * 0.12)), cv2.LINE_AA)
            cv2.polylines(shine, [track], False, 0.22, max(1, int(eye_w * 0.03)), cv2.LINE_AA)
            drop(end + np.array([0, eye_w * 0.12]), eye_w * 0.13)
    s1 = max(0.8, eye_w * 0.02)
    body = cv2.GaussianBlur(body, (0, 0), s1); edge = cv2.GaussianBlur(edge, (0, 0), s1); shine = cv2.GaussianBlur(shine, (0, 0), s1 * 0.7)
    # clearly blue tears (cartoon-style tear blue), with a deeper blue rim and a small white glint
    blue = np.array([64, 156, 255], np.float32)
    rim = np.array([24, 92, 214], np.float32)
    img = img * (1 - body[..., None]) + (img * 0.25 + blue * 0.75) * body[..., None]
    img = img * (1 - edge[..., None] * 0.8) + rim * (edge[..., None] * 0.8)
    img = img * (1 - shine[..., None]) + 255 * shine[..., None]
    return np.clip(img, 0, 255).astype(np.uint8)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # quiet
        pass

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        if self.path == '/health':
            return self.reply(200, {'ok': True, 'device': 'gpu' if GPU else 'cpu', 'moods': list(recipes()), 'version': VERSION, 'translator': os.path.exists(os.path.join(TR_DIR, 'config.json')), 'voice': voice_installed()})
        self.reply(404, {'ok': False})

    def do_POST(self):
        if self.path == '/shutdown':  # the Soulink server restarts us when this file changes
            self.reply(200, {'ok': True}); os._exit(0)
        if self.path == '/translate':
            try:
                req = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
                with tr_lock:
                    text = translate(req['text'], req['src'], req['tgt'])
                return self.reply(200, {'ok': True, 'text': text})
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                return self.reply(500, {'ok': False, 'error': str(e)})
        if self.path in ('/transcribe', '/speak'):
            try:
                req = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
                t0 = time.time()
                with voice_lock:
                    if self.path == '/transcribe':
                        res = {'text': transcribe(req['src'], req.get('lang'))}
                    else:
                        path, ms = speak(req['text'], req['lang'], req['out'])
                        res = {'out': path, 'durationMs': ms}
                return self.reply(200, {'ok': True, 'ms': int((time.time() - t0) * 1000), **res})
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                return self.reply(500, {'ok': False, 'error': str(e)})
        if self.path != '/edit':
            return self.reply(404, {'ok': False})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
            t0 = time.time()
            with lock:  # one at a time: keeps laptop memory low
                edit(req['src'], req['out'], req.get('mood', 'happy'), req.get('recipe'))
            self.reply(200, {'ok': True, 'ms': int((time.time() - t0) * 1000)})
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            self.reply(500, {'ok': False, 'error': str(e)})


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--selftest':
        src, out = sys.argv[2], sys.argv[3]
        for m in ['happy', 'shocked']:
            t0 = time.time(); edit(src, out.replace('.jpg', f'-{m}.jpg'), m)
            print(f'{m}: {time.time() - t0:.1f}s')
        print('SELFTEST OK')
        sys.exit(0)
    print(f'Soulmoji AI ready on 127.0.0.1:{PORT} ({"GPU" if GPU else "CPU"})', flush=True)
    ThreadingHTTPServer.allow_reuse_address = False  # Windows: never share the port with an older copy
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
