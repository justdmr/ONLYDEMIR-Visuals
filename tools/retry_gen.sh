#!/bin/bash
# Keep trying the missing stills (free GPU quota resets over time), then build their depth maps.
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
    bosphorus) echo "29|photorealistic night photograph of a huge red Turkish flag with white crescent and star waving in the wind in the foreground, the illuminated Bosphorus bridge in Istanbul behind it, colorful fireworks exploding over the water, mosque minarets on the skyline, long exposure reflections on the sea, cinematic, 8k" ;;
    velvet) echo "31|luxury macro product photograph, the word ONLYDEMIR as a three-dimensional jewelry logo made of polished white gold completely paved with brilliant cut diamonds, lying on black crushed velvet, dramatic studio lighting, sparkling diamond caustics, shallow depth of field, 8k, photorealistic" ;;
  esac
}
for round in $(seq 1 15); do
  left=0
  for k in neon space car bosphorus velvet; do
    [ -f "assets/photo/${k}_depth.png" ] && continue
    if [ ! -f "assets/photo/$k.jpg" ]; then
      pv="$(prompt_for $k)"; seed="${pv%%|*}"; prompt="${pv#*|}"
      $PY tools/gen.py "assets/photo/$k.jpg" "$seed" "$prompt" schnell 1920 1088 >/dev/null 2>&1
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
