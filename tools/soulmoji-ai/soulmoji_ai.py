# Soulmoji AI: changes the facial expression on a real photo with LivePortrait (open source, MIT code by
# Kuaishou / KwaiVGI, https://github.com/KwaiVGI/LivePortrait). Runs only on this laptop.
# The face is re-rendered by the model and pasted back into the ORIGINAL photo, so hair, background and
# resolution stay untouched; only the expression changes.
#
# Started automatically by the Soulink server (server/src/services/soulmojiAi.js). Local only: 127.0.0.1:8210
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

PORT = int(os.environ.get('SOULMOJI_AI_PORT', '8210'))
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
    'happy':    {'smile': 0.85, 'eyebrow': 4},
    'laugh':    {'smile': 1.25, 'grin': 6, 'open': 35, 'eyes': 0.75},
    'love':     {'smile': 0.7, 'eyebrow': 6, 'eyes': 0.9},
    'sad':      {'smile': -0.3, 'eyebrow': 12, 'purse': 6, 'gaze': (0, -10)},
    'cry':      {'smile': -0.3, 'eyebrow': 16, 'purse': 8, 'eyes': 0.7, 'gaze': (0, -8)},
    'angry':    {'smile': -0.25, 'eyebrow': -26, 'purse': -6, 'eyes': 0.85},
    'shocked':  {'eyebrow': 26, 'open': 95, 'eyes': 1.35},
    'tired':    {'smile': -0.1, 'eyes': 0.35, 'gaze': (0, -12)},
    'cool':     {'smile': 0.45, 'wink': 22},
    'party':    {'smile': 1.1, 'grin': 5, 'open': 25, 'eyebrow': 6},
    'thinking': {'eyebrow': 14, 'pout': 0.04, 'gaze': (14, 16)},
    'shy':      {'smile': 0.4, 'gaze': (0, -14), 'eyes': 0.85},
}

infer = InferenceConfig()
infer.flag_force_cpu = not GPU
infer.flag_use_half_precision = GPU
crop = CropConfig()
crop.flag_force_cpu = not GPU
wrapper = LivePortraitWrapper(inference_cfg=infer)
cropper = Cropper(crop_cfg=crop, flag_force_cpu=not GPU, image_type='human_face')
lock = Lock()
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
def edit(src, out, mood):
    p = prepare(src)
    r = MOODS.get(mood, MOODS['happy'])
    dev = wrapper.device
    x_c_s = p['kp']['kp'].to(dev)
    delta = p['kp']['exp'].to(dev).clone()
    scale = p['kp']['scale'].to(dev)
    t = p['kp']['t'].to(dev)
    R = p['R_s'].to(dev)
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
    x_d = wrapper.stitching(x_s, x_d)
    face = wrapper.parse_output(wrapper.warp_decode(p['f_s'].to(dev), x_s, x_d)['out'])[0]
    full = paste_back(face, p['M'], p['img'], p['mask'])
    cv2.imwrite(out, full[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 95])


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # quiet
        pass

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        if self.path == '/health':
            return self.reply(200, {'ok': True, 'device': 'gpu' if GPU else 'cpu', 'moods': list(MOODS)})
        self.reply(404, {'ok': False})

    def do_POST(self):
        if self.path != '/edit':
            return self.reply(404, {'ok': False})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
            t0 = time.time()
            with lock:  # one at a time: keeps laptop memory low
                edit(req['src'], req['out'], req.get('mood', 'happy'))
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
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
