#!/bin/bash
# Müzik İndir — Mac'te çift tıkla. Başka PC'de terminalden: bash muzik_indir.command [link]
# İlk açılışta yt-dlp + ffmpeg + deno'yu kendi klasörüne kurar. Dosyalar: ~/Downloads/Muzik
OUT="$HOME/Downloads/Muzik"; BIN="$HOME/.muzik-indir"; VER=3
MAC=0; [ "$(uname)" = Darwin ] && MAC=1
GUI=$MAC; [ -n "$SSH_TTY" ] && GUI=0
export PATH="$BIN:$PATH"
Y="$BIN/app/yt-dlp_macos"; [ $MAC = 1 ] || Y="$BIN/app/yt-dlp_linux"
GH=https://github.com

say() { echo "$1"; [ $GUI = 1 ] && osascript -e "display notification \"$1\" with title \"Müzik İndir\""; }
fail() { echo "HATA: $1"; [ $GUI = 1 ] && osascript -e "display alert \"Müzik İndir\" message \"$1\"" >/dev/null; exit 1; }

# yt-dlp klasör sürümü (tek dosyalık sürüm her açılışta saniyelerce açılıyordu)
get_ytdlp() {
  local f=yt-dlp_linux.zip; [ $MAC = 1 ] && f=yt-dlp_macos.zip
  rm -rf "$BIN/app" && mkdir -p "$BIN/app" &&
  curl -fsSL -o "$BIN/y.zip" "$GH/yt-dlp/yt-dlp/releases/latest/download/$f" &&
  unzip -oq "$BIN/y.zip" -d "$BIN/app" && rm "$BIN/y.zip" && chmod +x "$Y" && date +%s > "$BIN/updated"
}

setup() {
  say "İlk kurulum yapılıyor (1-2 dk)..."
  rm -rf "$BIN"; mkdir -p "$BIN"
  local a d f
  if [ $MAC = 1 ]; then
    if [ "$(uname -m)" = arm64 ]; then a=darwin-arm64; d=aarch64-apple-darwin; else a=darwin-x64; d=x86_64-apple-darwin; fi
  else a=linux-x64; d=x86_64-unknown-linux-gnu; fi
  echo "· yt-dlp"; get_ytdlp || fail "yt-dlp indirilemedi. İnterneti kontrol et."
  for f in ffmpeg ffprobe; do      # MP3'e çevirmek için ikisi de şart
    echo "· $f"
    curl -fsSL "$GH/eugeneware/ffmpeg-static/releases/download/b6.0/$f-$a.gz" | gunzip > "$BIN/$f" || fail "$f indirilemedi."
    chmod +x "$BIN/$f"
  done
  echo "· deno"                    # YouTube artık JavaScript çözücü istiyor
  curl -fsSL -o "$BIN/d.zip" "$GH/denoland/deno/releases/latest/download/deno-$d.zip" &&
    unzip -oq "$BIN/d.zip" -d "$BIN" && rm "$BIN/d.zip" || fail "deno indirilemedi."
  [ $MAC = 1 ] && for f in ffmpeg ffprobe deno; do codesign -s - -f "$BIN/$f" >/dev/null 2>&1; done
  "$Y" --version >/dev/null && ffmpeg -version >/dev/null && ffprobe -version >/dev/null && deno --version >/dev/null ||
    fail "Kurulum tamamlanamadı. Dosyayı tekrar aç."
  echo $VER > "$BIN/ver"
}
[ "$(cat "$BIN/ver" 2>/dev/null)" = $VER ] || setup
mkdir -p "$OUT"

# Haftada bir arka planda güncelle (açılışı yavaşlatmaz)
[ $(( $(date +%s) - $(cat "$BIN/updated" 2>/dev/null || echo 0) )) -gt 604800 ] && (get_ytdlp >/dev/null 2>&1 &)

# Daha önce webm/opus olarak kalanları MP3'e çevir
for w in "$OUT"/*.webm "$OUT"/*.opus; do
  [ -e "$w" ] || continue
  echo "Çevriliyor: $(basename "$w")"
  ffmpeg -loglevel error -y -i "$w" -vn -b:a 320k "${w%.*}.mp3" && rm "$w"
done

ask() {
  if [ $GUI = 1 ]; then
    osascript -e 'text returned of (display dialog "YouTube linkini yapıştır (şarkı ya da playlist):" default answer "" with title "Müzik İndir" buttons {"Kapat", "İndir"} default button "İndir" cancel button "Kapat")' 2>/dev/null
  else read -rp "YouTube linki (boş = çık): " l; echo "$l"; fi
}
fmt() {
  if [ $GUI = 1 ]; then
    osascript -e 'button returned of (display dialog "Format seç:" with title "Müzik İndir" buttons {"Orijinal M4A (en temiz)", "MP3 320"} default button "MP3 320")' 2>/dev/null
  else read -rp "1 = MP3 320, 2 = Orijinal M4A [1]: " c; [ "$c" = 2 ] && echo Orijinal || echo MP3; fi
}
dl() {
  "$Y" "${A[@]}" --embed-thumbnail --add-metadata --ignore-errors --no-mtime --newline \
    -o "$OUT/%(title)s.%(ext)s" "$LINK" 2>&1 | tee "$BIN/son.log"
  [ "${PIPESTATUS[0]}" = 0 ]
}

LINK="$1"
while :; do
  [ -z "$LINK" ] && LINK=$(ask)
  [ -z "$LINK" ] && exit 0
  case "$(fmt)" in
    Orijinal*) A=(-f "bestaudio[ext=m4a]/bestaudio" -x --audio-format m4a) ;;
    *)         A=(-x --audio-format mp3 --audio-quality 320K) ;;
  esac
  echo "İndiriliyor → $OUT"
  # Olmazsa yt-dlp'yi güncelleyip bir kez daha dene (YouTube sık değişiyor)
  if dl || { echo "Güncellenip tekrar deneniyor..."; get_ytdlp && dl; }; then
    say "Bitti ✓"; [ $GUI = 1 ] && open "$OUT"
  else
    E=$(grep -m1 ERROR "$BIN/son.log" | cut -c1-200 | tr -d '"\\')
    [ $GUI = 1 ] && osascript -e "display alert \"İndirilemedi\" message \"${E:-Bilinmeyen hata}\"" >/dev/null || echo "İndirilemedi: $E"
  fi
  rm -f "$OUT"/*.webp "$OUT"/*.jpg   # yarım kalan indirmelerin kapak resimleri
  LINK=""
done
