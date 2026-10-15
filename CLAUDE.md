# ONLYDEMIR Visuals — handoff notes

Live, audio-reactive stage visuals for the DJ **ONLYDEMIR** (first gig theme: 29 Ekim / Cumhuriyet 103). Runs in Chrome from a local web server; projected fullscreen on stage.

## Working with the user
- **Speak Turkish.** The user is the DJ; non-technical about code, very demanding about looks.
- Everything must look **professional and photoreal** ("gerçekmiş gibi", 4K). Primitive/procedural 3D people, cartoon props or effects that look pasted-on were rejected as amateur. Prefer real assets (CC0 HDRIs/models, AI photoreal stills + depth parallax).
- **Be proactive**: each round, add new, different high-end ideas on your own; the user dislikes having to repeat requests.
- The user has granted broad permission to research, install tools and iterate.
- Respect their saved settings in the app (e.g. they chose the MIDI Clock tempo source) — don't overwrite `localStorage` settings while testing without restoring them.

## Run it
```
python3 -m http.server 8766 --bind 127.0.0.1   # then open http://localhost:8766/index.html
```
Or double-click `start.command` (macOS, port 8765). Must be served over http (ES modules + import map); `file://` shows a warning screen.

## Architecture (vanilla JS + three.js r160, no build step)
- `index.html` — UI panel (tabs CANLI / GÖRÜNÜM / YAZI / SİSTEM), import map → `lib/three/…` (vendored three.js; folder is `lib/`, NOT `vendor/`, so the desktop app copies it when moving sessions).
- `js/main.js` — state `S` (+ `DEFAULTS`, persisted to `localStorage` key `odv_cfg`, migration via `CFG_VERSION`), scene list/order, director/auto-switch, scene lock, presets, MIDI (notes, CC, clock), keyboard, recording, generic control builder (`GROUPS` → sliders/segments).
- `js/clock.js` — beat clock: auto / manual / lock (PLL to onsets) / MIDI clock; latency offset; bar position.
- `js/audio.js` — mic or demo track, spectrum + waveform, onset detection, break/drop detection.
- `js/fx.js` — compositor: scene A/B render targets → compose (transitions, mirror/kaleido, punch/shake, EQ overlay, text layer) → feedback → afterimage → bloom → final (glitch, RGB, ACES tone map, grade, grain, sRGB).
- `js/common.js` — shared context: HDRI environments (`ENVS`, Poly Haven, `ctx.envMap`, `ctx.loadHDR`), chrome materials, merged Exo 2 font (latin + latin-ext for Turkish), chrome text, crescent-star geometry, sparkles, dust, shader preamble.
- `js/scenes/photo.js` — **2.5D "living photo" scenes** (the most professional ones, shown first): photo + depth map → displaced mesh, BPM-synced camera sway/kicks, beat-synced framing cuts, auto-detected diamond glints, rain/dust/fireworks/flare. Defined in `PHOTO_DEFS`; a def is skipped automatically if `assets/photo/<name>_depth.png` is missing.
- `js/scenes/real.js` — Gece Şehri (Shanghai HDRI backdrop), Mermer Büst (scanned bust), TV Duvarı (scanned CRTs with live channels). `IcedPhotoScene` (3D chain composited on a photo) is kept in the file but no longer listed — the user found it fake-looking.
- `js/scenes/name.js` — Earth orbit (4K textures), black hole, neon sign, vinyl deck, foil balloons, hologram (+ unused 3D mannequin `IcedScene`).
- `js/scenes/chrome.js`, `particles.js`, `flag.js`, `spectrum.js`, `shaders.js`, `more.js`, `more3d.js` — older 3D/shader scenes. Weaker shader scenes are excluded from the auto playlist by default (`DEFAULTS.off`).

## Asset pipeline (photoreal 2.5D scenes)
1. Generate a still: `python3 tools/gen.py assets/photo/<name>.jpg <seed> "<prompt>" schnell 1920 1088` — uses the public Hugging Face space `black-forest-labs/FLUX.1-schnell` (anonymous ZeroGPU quota; returns `event: error` with null data when the quota is exhausted — wait or use another IP/account). FLUX.1-dev space returned noise at 1920×1088.
2. Check the image yourself (spelling of ONLYDEMIR in the image matters; reject misspellings).
3. Depth map: `tools/.venv/bin/python tools/depth_local.py assets/photo/<name>.jpg` → `<name>_depth.png`. Uses **Depth Anything V2 Small (Apache-2.0)** — do NOT use Base/Large (CC-BY-NC, non-commercial; the gigs are paid). Needs `python3 -m venv tools/.venv && tools/.venv/bin/pip install torch transformers pillow` (venv is git-ignored).
4. Add/enable the entry in `PHOTO_DEFS` (glint rect, flags) and test at 16:9.

Dead ends: Canva's connector can generate images but export is forbidden (only 600px thumbnails); Pollinations returned low-quality watermarked 1024px; Unsplash blocks scripted requests (and real people's faces shouldn't be used as models anyway).

## Pending work (pick up here)
1. **Five photo scenes are defined but missing their images** (quota ran out locally): `neon`, `space`, `car`, `bosphorus`, `velvet`. Exact prompts/seeds are in `tools/retry_gen.sh` (it also runs the depth step). Generate, review each image, then run depth. Accept only images where text reads exactly "ONLYDEMIR".
2. Verify every photo scene at 1280×720 (glint placement, framing cuts, no edge reveals). In the desktop Browser pane, navigating while a viewport size is emulated renders into a corner — reset to desktop, load, then emulate.
3. Ideas backlog (user wants new pro concepts each round): more 2.5D photo concepts (luxury/jewelry macro, rooftop crowd, Istanbul skyline for 29 Ekim, Anıtkabir night), lens-dirt/anamorphic flares on beats, depth-of-field for 3D scenes, an HDR "hero" logo reveal sequence for drops, preset packs (e.g. "29 Ekim", "Club", "Luxury").

## Licenses
See `assets/CREDITS.txt` (Poly Haven CC0, Solar System Scope CC BY 4.0 — credit in published recordings, FLUX schnell Apache-2.0, fonts OFL, three.js MIT).
