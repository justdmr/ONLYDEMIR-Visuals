# Depth Anything V2 *Small* via ONNX Runtime (no torch, no Hugging Face access needed).
# usage: depth_onnx.py in.jpg [more.jpg ...]  -> writes <name>_depth.png (near = white), same format as depth_local.py
# Weights: fabio-sim/Depth-Anything-ONNX v2.0.0 release (ViT-S export, Apache-2.0). Base/Large are non-commercial: never use them.
# Setup: python3 -m venv tools/.venv && tools/.venv/bin/pip install onnxruntime numpy pillow
import hashlib, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageFilter
import onnxruntime as ort

URL = 'https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vits_dynamic.onnx'
SHA = '46c4e8eeda3a27f34701831b6a2ec7753d7b38779b215acb5633424703deed8f'
MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'depth_anything_v2_vits_dynamic.onnx')

def ensure_model():
    if not os.path.exists(MODEL):
        os.makedirs(os.path.dirname(MODEL), exist_ok=True)
        print('downloading', URL)
        urllib.request.urlretrieve(URL, MODEL + '.part')
        os.replace(MODEL + '.part', MODEL)
    h = hashlib.sha256(open(MODEL, 'rb').read()).hexdigest()
    if h != SHA:
        sys.exit('model checksum mismatch: ' + h)

def input_size(w, h, target=518, mult=14):
    # Mirrors the HF DPTImageProcessor used by depth_local.py: keep aspect ratio, scale as little as possible, multiple of 14.
    sw, sh = target / w, target / h
    if abs(1 - sw) < abs(1 - sh): sh = sw
    else: sw = sh
    return max(mult, round(w * sw / mult) * mult), max(mult, round(h * sh / mult) * mult)

ensure_model()
sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
mean, std = np.array([0.485, 0.456, 0.406], np.float32), np.array([0.229, 0.224, 0.225], np.float32)
for src in [a for a in sys.argv[1:] if not a.startswith('--')]:
    img = Image.open(src).convert('RGB')
    iw, ih = input_size(*img.size)
    x = (np.asarray(img.resize((iw, ih), Image.BICUBIC), np.float32) / 255 - mean) / std
    d = sess.run(None, {'image': x.transpose(2, 0, 1)[None]})[0][0]
    d = np.asarray(Image.fromarray(d.astype(np.float32), 'F').resize(img.size, Image.BICUBIC))
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    out = Image.fromarray((d * 255).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
    dst = src.rsplit('.', 1)[0] + '_depth.png'
    out.save(dst)
    print('ok', dst, out.size)
