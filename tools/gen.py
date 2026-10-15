# Generate an image with FLUX.1 [schnell].  usage: gen.py out.jpg seed "prompt" [dev|schnell] [w] [h]
# 1) the public Hugging Face space (ZeroGPU). Anonymous quota is per IP and often 0 on shared cloud IPs;
#    with HF_TOKEN set (free account token) the quota is your account's.
# 2) with HF_TOKEN, if the space fails: Hugging Face Inference Providers through router.huggingface.co
#    (hf-inference, then together) — small free monthly credit, a few tenths of a cent per image.
import base64, io, json, os, random, string, sys, time, urllib.request, urllib.error

out, seed, prompt = sys.argv[1], int(sys.argv[2]), sys.argv[3]
model = sys.argv[4] if len(sys.argv) > 4 else 'schnell'
w = int(sys.argv[5]) if len(sys.argv) > 5 else 1920
h = int(sys.argv[6]) if len(sys.argv) > 6 else 1088
token = os.environ.get('HF_TOKEN') or os.environ.get('HUGGING_FACE_HUB_TOKEN')
auth = {'Authorization': 'Bearer ' + token} if token else {}
space = 'https://black-forest-labs-flux-1-dev.hf.space' if model == 'dev' else 'https://black-forest-labs-flux-1-schnell.hf.space'
data = [prompt, seed, False, w, h, 3.5, 28] if model == 'dev' else [prompt, seed, False, w, h, 4]

def save(raw):
    from PIL import Image
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    if img.size != (w, h):
        img = img.resize((w, h), Image.LANCZOS)
    img.save(out, 'JPEG', quality=95)
    print('ok', out, img.size)
    sys.exit(0)

def post(url, body, extra=None, timeout=300):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', **auth, **(extra or {})})
    return urllib.request.urlopen(req, timeout=timeout)

def via_space():
    # gradio queue protocol: unlike /call it reports the real error (e.g. "ZeroGPU quota exceeded")
    api = space + '/gradio_api'
    cfg = json.load(urllib.request.urlopen(urllib.request.Request(space + '/config', headers=auth), timeout=60))
    dep = next(d for d in cfg['dependencies'] if d.get('api_name') == 'infer')
    sh = ''.join(random.choice(string.ascii_lowercase) for _ in range(11))
    post(api + '/queue/join', {'data': data, 'fn_index': cfg['dependencies'].index(dep), 'session_hash': sh, 'trigger_id': dep.get('id'), 'event_data': None}, timeout=60)
    stream = urllib.request.urlopen(urllib.request.Request(api + '/queue/data?session_hash=' + sh, headers=auth), timeout=600)
    for line in stream:
        line = line.decode().strip()
        if not line.startswith('data:'):
            continue
        msg = json.loads(line[5:])
        if msg.get('msg') == 'process_completed':
            if not msg.get('success'):
                raise RuntimeError((msg.get('output') or {}).get('error') or msg.get('title') or 'space error')
            img = msg['output']['data'][0]
            url = img.get('url') or space + '/gradio_api/file=' + img['path']
            return urllib.request.urlopen(urllib.request.Request(url, headers=auth), timeout=120).read()
    raise RuntimeError('space stream ended without a result')

def via_hf_inference():
    r = post('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
             {'inputs': prompt, 'parameters': {'width': w, 'height': h, 'num_inference_steps': 4, 'seed': seed}}, {'Accept': 'image/png'})
    if not r.headers.get('Content-Type', '').startswith('image/'):
        raise RuntimeError(r.read()[:300].decode(errors='replace'))
    return r.read()

def via_together():
    last = None
    for ww, hh in [(w, h), (1792, 1008), (1440, 816)]:   # providers cap the size; we upscale back with Lanczos
        try:
            r = json.load(post('https://router.huggingface.co/together/v1/images/generations',
                               {'model': 'black-forest-labs/FLUX.1-schnell', 'prompt': prompt, 'width': ww, 'height': hh, 'steps': 4, 'seed': seed, 'n': 1, 'response_format': 'b64_json'}))
            return base64.b64decode(r['data'][0]['b64_json'])
        except urllib.error.HTTPError as e:
            last = RuntimeError(f'{e.code} {e.read()[:200].decode(errors="replace")}')
    raise last

routes = [('space', via_space)] + ([('hf-inference', via_hf_inference), ('together', via_together)] if token else [])
for name, fn in routes:
    for attempt in range(2 if name == 'space' else 1):
        try:
            save(fn())
        except SystemExit:
            raise
        except Exception as e:
            err = e.read()[:200].decode(errors='replace') if isinstance(e, urllib.error.HTTPError) else str(e)
            print(f'{name} failed: {err}', file=sys.stderr)
            if 'quota' in err.lower():
                break
            time.sleep(6)
print('FAILED' + ('' if token else ' (tip: set HF_TOKEN to use your own Hugging Face quota)'))
sys.exit(1)
