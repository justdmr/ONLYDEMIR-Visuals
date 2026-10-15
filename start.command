#!/bin/bash
# ONLYDEMIR Visuals: serves this folder locally and opens it in Chrome (works offline).
cd "$(dirname "$0")"
PORT=8765
if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  sleep 1
fi
URL="http://localhost:$PORT/index.html"
open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"
echo "ONLYDEMIR Visuals açık: $URL"
echo "Kapatmak için bu pencereyi kapat."
[ -n "$SERVER" ] && wait $SERVER
