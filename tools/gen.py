# Generate an image with a FLUX Hugging Face space.  usage: gen.py out.jpg seed "prompt" [dev|schnell] [w] [h]
import json, os, sys, urllib.request, re, subprocess
out, seed, prompt = sys.argv[1], int(sys.argv[2]), sys.argv[3]
model = sys.argv[4] if len(sys.argv) > 4 else 'dev'
w = int(sys.argv[5]) if len(sys.argv) > 5 else 1920
h = int(sys.argv[6]) if len(sys.argv) > 6 else 1088
if model == 'dev':
    base = 'https://black-forest-labs-flux-1-dev.hf.space/gradio_api/call/infer'
    data = [prompt, seed, False, w, h, 3.5, 28]
else:
    base = 'https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/call/infer'
    data = [prompt, seed, False, w, h, 4]
import time
m = None
for attempt in range(4):
    try:
        req = urllib.request.Request(base, data=json.dumps({"data": data}).encode(), headers={'Content-Type': 'application/json'})
        eid = json.load(urllib.request.urlopen(req, timeout=60))['event_id']
        res = urllib.request.urlopen(base + '/' + eid, timeout=600).read().decode()
        m = re.findall(r'"url":\s*"([^"]+)"', res)
        if m: break
    except Exception as e:
        res = str(e)
    time.sleep(8 + attempt * 8)
if not m:
    print('FAILED', res[-300:]); sys.exit(1)
tmp = out + '.webp'
urllib.request.urlretrieve(m[0], tmp)
try:  # Pillow works everywhere (cloud/Linux); sips is the macOS fallback
    from PIL import Image
    Image.open(tmp).convert('RGB').save(out, 'JPEG', quality=95)
except ImportError:
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '95', tmp, '--out', out], capture_output=True)
os.remove(tmp)
print('ok', out)
