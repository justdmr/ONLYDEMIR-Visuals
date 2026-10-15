#!/bin/bash
# Keep trying the missing stills (free GPU quota resets over time), then build their depth maps.
# Set HF_TOKEN (free Hugging Face token) to use your own GPU quota instead of the shared anonymous one.
# Review every image afterwards: text must read exactly ONLYDEMIR; any Turkish flag must have the real geometry
# (crescent opening toward the fly, the star separate inside the opening) — AI often breaks it, so prompts avoid close-up flags; delete rejects (jpg + _depth.png) and rerun with another seed.
cd "$(dirname "$0")/.."
# depth: ONNX Runtime build of Depth Anything V2 Small if available (no torch / Hugging Face needed), else transformers
if tools/.venv/bin/python -c "import onnxruntime" 2>/dev/null; then DEPTH="tools/.venv/bin/python tools/depth_onnx.py"
else DEPTH="tools/.venv/bin/python tools/depth_local.py"; fi
PY=python3; tools/.venv/bin/python -c "import PIL" 2>/dev/null && PY=tools/.venv/bin/python
prompt_for() {
  case "$1" in
    neon) echo "5|cinematic night photograph of a narrow rainy Tokyo back alley, a glowing red neon sign on a dark brick wall that spells ONLYDEMIR in elegant bold italic neon tube letters, wet asphalt with long colorful reflections, steam, light rain, volumetric haze, puddles, shallow depth of field, shot on 35mm anamorphic lens, photorealistic, 8k" ;;
    space) echo "3|photorealistic photograph, an astronaut in a white spacesuit seen from behind floating in orbit, looking at the planet Earth, a thin blue atmosphere glowing on the horizon, sunrise flare over the curve of the earth, city lights on the night side, stars, NASA style, ultra detailed, 8k" ;;
    car) echo "21|photorealistic automotive photograph of a sleek black supercar parked in a dark underground garage with red neon light strips on the ceiling, glossy wet floor reflections, the front license plate reads ONLYDEMIR, dramatic low angle, cinematic lighting, 8k" ;;
    bosphorus) echo "61|photorealistic night photograph of the illuminated Bosphorus bridge in Istanbul lit in red and white light, colorful fireworks exploding over the water, mosques with minarets glowing on the skyline, ferries with lights, long exposure reflections on the dark sea, cinematic wide shot, 8k" ;;
    monolith) echo "41|cinematic hyperreal CGI render, a colossal dark forged iron human head half submerged in still black water, glowing molten red cracks running across its face, a single shaft of white light from above, thick volumetric fog, a tiny human silhouette on the shore for scale, unreal engine 5, 8k" ;;
    angel) echo "43|hyperreal cinematic render of a giant white porcelain and polished chrome female android with large mechanical wings kneeling in a vast dark brutalist concrete hall, beams of white light cutting through haze, thin red light strips on the floor, unreal engine 5, octane render, 8k" ;;
    rooftop) echo "47|photorealistic night photograph of an exclusive rooftop party above a glittering city skyline, crowd silhouettes with raised hands, a DJ booth with a glowing white LED sign that reads ONLYDEMIR, red and white laser beams in light haze, shot on 24mm, cinematic, 8k" ;;
    anitkabir) echo "53|photorealistic night photograph of Anitkabir mausoleum in Ankara illuminated with warm golden light, the long colonnade glowing, fireworks in the dark blue sky above, long exposure, cinematic wide shot, 8k" ;;
    velvet) echo "31|luxury macro product photograph, the word ONLYDEMIR as a three-dimensional jewelry logo made of polished white gold completely paved with brilliant cut diamonds, lying on black crushed velvet, dramatic studio lighting, sparkling diamond caustics, shallow depth of field, 8k, photorealistic" ;;
  esac
}
for round in $(seq 1 15); do
  left=0
  for k in neon space car bosphorus velvet monolith angel rooftop anitkabir; do
    [ -f "assets/photo/${k}_depth.png" ] && continue
    if [ ! -f "assets/photo/$k.jpg" ]; then
      pv="$(prompt_for $k)"; seed="${pv%%|*}"; prompt="${pv#*|}"
      echo "$k: $($PY tools/gen.py "assets/photo/$k.jpg" "$seed" "$prompt" schnell 1920 1088 2>&1 | tail -1)"
    fi
    if [ -f "assets/photo/$k.jpg" ]; then
      $DEPTH "assets/photo/$k.jpg" 2>/dev/null | grep '^ok'
    else left=$((left+1)); fi
  done
  echo "round $round: $left left"
  [ $left -eq 0 ] && break
  sleep 240
done
ls assets/photo
