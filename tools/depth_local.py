# Depth Anything V2 (local). usage: depth_local.py in.jpg [more.jpg ...]  -> writes <name>_depth.png (16-bit-ish, near = white)
import sys, warnings
warnings.filterwarnings('ignore')
import torch, numpy as np
from PIL import Image, ImageFilter
from transformers import AutoImageProcessor, AutoModelForDepthEstimation
name = 'depth-anything/Depth-Anything-V2-Small-hf'  # Apache-2.0; the Base/Large weights are non-commercial
proc = AutoImageProcessor.from_pretrained(name)
model = AutoModelForDepthEstimation.from_pretrained(name).eval()
dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
model.to(dev)
for src in [a for a in sys.argv[1:] if not a.startswith('--')]:
    img = Image.open(src).convert('RGB')
    inp = proc(images=img, return_tensors='pt').to(dev)
    with torch.no_grad():
        d = model(**inp).predicted_depth
    d = torch.nn.functional.interpolate(d.unsqueeze(1), size=img.size[::-1], mode='bicubic', align_corners=False)[0, 0].cpu().numpy()
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    out = Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
    dst = src.rsplit('.', 1)[0] + '_depth.png'
    out.save(dst)
    print('ok', dst, out.size)
