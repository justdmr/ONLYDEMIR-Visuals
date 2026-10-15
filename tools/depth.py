# Depth map via the Depth Anything V2 Hugging Face space.  usage: depth.py in.jpg out_depth.png
import json, sys, urllib.request, re, uuid, subprocess
src, out = sys.argv[1], sys.argv[2]
host = 'https://depth-anything-depth-anything-v2.hf.space'
data = open(src, 'rb').read()
b = uuid.uuid4().hex
body = (f'--{b}\r\nContent-Disposition: form-data; name="files"; filename="img.jpg"\r\nContent-Type: image/jpeg\r\n\r\n').encode() + data + f'\r\n--{b}--\r\n'.encode()
path = json.load(urllib.request.urlopen(urllib.request.Request(host + '/gradio_api/upload', data=body, headers={'Content-Type': f'multipart/form-data; boundary={b}'}), timeout=120))[0]
payload = {"data": [{"path": path, "meta": {"_type": "gradio.FileData"}}]}
eid = json.load(urllib.request.urlopen(urllib.request.Request(host + '/gradio_api/call/on_submit', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}), timeout=60))['event_id']
res = urllib.request.urlopen(host + '/gradio_api/call/on_submit/' + eid, timeout=600).read().decode()
urls = re.findall(r'"url":\s*"([^"]+)"', res)
gray = [u for u in urls if u.endswith('.png')]
if not gray:
    print('FAILED', res[-500:]); sys.exit(1)
# second output is the grayscale depth map
urllib.request.urlretrieve(gray[-2] if len(gray) >= 2 else gray[0], out)
print('ok', out, urls)
