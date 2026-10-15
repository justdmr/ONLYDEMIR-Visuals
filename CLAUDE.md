# ONLYDEMIR Visuals — handoff notes

Live, audio-reactive stage visuals for the DJ **ONLYDEMIR** (first gig theme: 29 Ekim / Cumhuriyet 103). Runs in Chrome from a local web server; projected fullscreen on stage.

## Working on this project
- **Communicate in Turkish.**
- Quality bar: everything must look **professional and photoreal** (4K, "gerçekmiş gibi"). Primitive/procedural 3D people, cartoon props or effects that look pasted-on don't meet it. Prefer real assets (CC0 HDRIs/models, AI photoreal stills + depth parallax).
- **Be proactive**: each round, add new, different high-end ideas without waiting to be asked.
- Research, installing tools and iterating are all welcome.
- Respect the saved in-app settings (e.g. the MIDI Clock tempo source) — don't overwrite `localStorage` settings while testing without restoring them.
- Art direction (user, Oct 2026): like Anyma / Afterlife (monumental, cinematic, dark, hyperreal CGI) but **not a copy**. Our own hook is **DEMİR = iron**: forged-iron entity with molten red veins, particle head, glass-shatter, chrome name. Market references researched: Anyma "The End of Genesys" (Eva cyborg with glowing veins, robot breaking the screen glass, faces shattering into shards, UE5 + Notch real-time), Afterlife (Notch particle fields), Motive (Taycan launch: entrance from a giant cube).
- UI must stay simple and tidy (user request): scene-specific settings live under that scene's ⚙, not in global lists.

## Run it
```
python3 -m http.server 8766 --bind 127.0.0.1   # then open http://localhost:8766/index.html
```
Or double-click `start.command` (macOS, port 8765). Must be served over http (ES modules + import map); `file://` shows a warning screen.

## Architecture (vanilla JS + three.js r160, no build step)
- `index.html` — UI panel (tabs CANLI / GÖRÜNÜM / YAZI / SİSTEM), import map → `lib/three/…` (vendored three.js; folder is `lib/`, NOT `vendor/`, so the desktop app copies it when moving sessions).
- `js/main.js` — state `S` (+ `DEFAULTS`, persisted to `localStorage` key `odv_cfg`, migration via `CFG_VERSION`), scene list/order, director/auto-switch, scene lock, presets, MIDI (notes, CC, clock), keyboard, recording, generic control builder (`GROUPS` → sliders/segments; a def can carry its own get/set).
  - **Loop**: the tick box on each scene button = in the loop (`S.off` holds the unticked keys). Auto modes `off | seq (Sıralı) | timed (Karışık) | director` only play ticked scenes.
  - **Per-scene settings**: ⚙ on a scene opens its panel inline (`sceneOptions()`); values live in `S.sc[sceneKey][name]`, read in scenes via `sceneOpt(S, key, name, fallback)` from `common.js` (old global keys like `photoMotion` remain the fallback). Chrome scenes can pick their own HDRI.
  - **Hazır görünümler** (`PACKS`): one-click looks (29 Ekim, Club, Luxury, Festival, Demir, Minimal) that never touch tempo/audio/name/loop.
  - New scenes are appended at the END of the `scenes` array so keyboard/MIDI pad numbers of existing scenes don't move (photo scenes are first by design and shift when new photos appear).
- `js/clock.js` — beat clock: auto / manual / lock (PLL to onsets) / MIDI clock; latency offset; bar position.
- `js/audio.js` — mic or demo track, spectrum + waveform, onset detection, break/drop detection.
- `js/fx.js` — compositor: scene A/B render targets → compose (transitions incl. **Cam kırılma** glass shatter, mirror/kaleido, punch/shake, EQ overlay, drop-logo overlay, text layer with styles + light sweep) → feedback → afterimage → **lens** (anamorphic streaks, soft ghosts/halo, lens dirt; local adaptation so only point highlights flare) → bloom → final (glitch, RGB, ACES tone map, grade, grain, sRGB). NaN/overflow guards on scene inputs and in the lens chain; frame `dt` is clamped ≥ 0 (negative dt once caused black frames).
- `js/sting.js` — drop logo: HDR chrome reveal of `S.name` (Unbounded Black 3D) in its own chrome-studio env, exaggerated reflection perspective (`uPersp`) so flat faces read as chrome, beat-paced light sweep + flare, sparks. Fires on drops (`S.sting`), key O, last MIDI FX pad.
- `js/common.js` — shared context: HDRI environments (`ENVS`, Poly Haven, `ctx.envMap`, `ctx.loadHDR`), chrome materials, merged Exo 2 font (latin + latin-ext for Turkish), chrome text, crescent-star geometry, sparkles, dust, shader preamble.
- `js/scenes/photo.js` — **2.5D "living photo" scenes** (the most professional ones, shown first): photo + depth map → displaced mesh, BPM-synced camera sway/kicks, beat-synced framing cuts, auto-detected diamond glints, rain/dust/fireworks/flare. Defined in `PHOTO_DEFS`; a def is skipped automatically if `assets/photo/<name>_depth.png` is missing.
- `js/scenes/real.js` — Gece Şehri (Shanghai HDRI backdrop), Mermer Büst (scanned bust), TV Duvarı (scanned CRTs with live channels). `IcedPhotoScene` (3D chain composited on a photo) is kept in the file but no longer listed — the user found it fake-looking.
- `js/scenes/entity.js` — **Demir Varlık** (scanned bust as forged iron with molten Voronoi veins, light shafts, embers, bar-synced shots) and **Parçacık Varlık** (140k-point cloud of the bust, scan line + drop dispersal). Category `ent` ("Sinematik 3D · Demir").
- `js/scenes/name.js` — Earth orbit (4K textures), black hole, neon sign, vinyl deck, foil balloons, hologram (+ unused 3D mannequin `IcedScene`).
- `js/scenes/chrome.js`, `particles.js`, `flag.js`, `spectrum.js`, `shaders.js`, `more.js`, `more3d.js` — older 3D/shader scenes. Weaker shader scenes are excluded from the auto playlist by default (`DEFAULTS.off`).

## Asset pipeline (photoreal 2.5D scenes)
1. Generate a still: `python3 tools/gen.py assets/photo/<name>.jpg <seed> "<prompt>" schnell 1920 1088` — uses the public Hugging Face space `black-forest-labs/FLUX.1-schnell` (anonymous ZeroGPU quota; returns `event: error` with null data when the quota is exhausted — wait or use another IP/account). FLUX.1-dev space returned noise at 1920×1088.
2. Check the image yourself (spelling of ONLYDEMIR in the image matters; reject misspellings).
3. Depth map: `tools/.venv/bin/python tools/depth_onnx.py assets/photo/<name>.jpg` → `<name>_depth.png` (ONNX Runtime, no torch/HF; the model downloads once from the fabio-sim/Depth-Anything-ONNX GitHub release into git-ignored `tools/models/`, checksum-verified; output matches the transformers version, corr 1.0000). Setup: `python3 -m venv tools/.venv && tools/.venv/bin/pip install onnxruntime numpy pillow`. The older `depth_local.py` (transformers) still works on the Mac. Only **Depth Anything V2 Small (Apache-2.0)** — never Base/Large (CC-BY-NC; the gigs are paid).
4. Add/enable the entry in `PHOTO_DEFS` (glint rect, flags) and test at 16:9.

Cloud sessions: the environment's network policy blocks `huggingface.co` / `*.hf.space` unless they are added under Network access → Allowed domains (`huggingface.co`, `*.hf.space`, `*.hf.co`). Even with access, the space's anonymous ZeroGPU quota is per IP and is **0 on the shared cloud IP** ("You have exceeded your ZeroGPU quota (90s requested vs. 0s left)"). Fix: a free Hugging Face token as environment variable `HF_TOKEN` (read + "Make calls to Inference Providers"); `gen.py` then uses the account's quota and falls back to Inference Providers via `router.huggingface.co`. The Mac's own IP usually still has anonymous quota. GitHub, npm and PyPI are reachable (fonts come from Fontsource on npm).

Testing: `node tools/shoot.mjs [--scenes=iron,ghost] [--size=1280x720] [--out=shots]` opens the app in a fresh headless Chromium profile (never touches your saved settings), screenshots each scene and lists console/page errors. Software WebGL is slow (~2 fps), so beat-driven things progress slowly there.

Dead ends: Canva's connector can generate images but export is forbidden (only 600px thumbnails); Pollinations returned low-quality watermarked 1024px; Unsplash blocks scripted requests (and real people's faces shouldn't be used as models anyway).

## Pending work (pick up here)
1. **Photo stills still missing** (HF blocked from the cloud env and quota-limited locally): `neon`, `space`, `car`, `bosphorus`, `velvet` + new DEMİR concepts `monolith`, `angel`, `rooftop`, `anitkabir`. Run `tools/retry_gen.sh` (prompts/seeds inside; it also builds depth). Review every image: text must read exactly "ONLYDEMIR"; Anıtkabir must look like the real monument — otherwise delete and retry another seed.
2. Verify new photo scenes at 1280×720 (glint placement, framing cuts, no edge reveals). In the desktop Browser pane, navigating while a viewport size is emulated renders into a corner — reset to desktop, load, then emulate.
3. Earth scene's astronaut is a primitive mannequin (below the quality bar) — it can be switched off under that scene's ⚙; replace with a real asset or a photo scene.
4. Ideas backlog: robot/android "breaking the screen glass" sequence (use the shatter transition + a hero 3D asset), depth-of-field for 3D scenes, anamorphic 3D "LED box" illusion scene, more DEMİR concepts (iron Turkish crescent & star forging for 29 Ekim), MIDI-learn for per-scene options.

## Licenses
See `assets/CREDITS.txt` (Poly Haven CC0, Solar System Scope CC BY 4.0 — credit in published recordings, FLUX schnell Apache-2.0, fonts OFL, three.js MIT).
