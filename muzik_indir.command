#!/bin/bash
# Müzik İndir — Mac'te çift tıkla. Başka PC'de terminalden: bash muzik_indir.command [link]
# İlk açılışta yt-dlp + ffmpeg'i kendisi kurar. Dosyalar: ~/Downloads/Muzik
OUT="$HOME/Downloads/Muzik"; BIN="$HOME/.muzik-indir"
mkdir -p "$OUT" "$BIN"
export PATH="$BIN:/opt/homebrew/bin:/usr/local/bin:$PATH"
MAC=0; [ "$(uname)" = Darwin ] && MAC=1
GUI=$MAC; [ -n "$SSH_TTY" ] && GUI=0

if ! command -v yt-dlp >/dev/null; then
  echo "yt-dlp kuruluyor..."
  [ $MAC = 1 ] && f=yt-dlp_macos || f=yt-dlp_linux
  curl -fL -o "$BIN/yt-dlp" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$f" && chmod +x "$BIN/yt-dlp"
fi
# MP3'e çevirmek için ffmpeg + ffprobe ikisi de şart (yoksa webm olarak kalıyor)
if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
  echo "ffmpeg kuruluyor..."
  if [ $MAC = 1 ]; then
    [ "$(uname -m)" = arm64 ] && a=arm64 || a=x64
    for t in ffmpeg ffprobe; do
      curl -fL "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/$t-darwin-$a.gz" | gunzip > "$BIN/$t"
      chmod +x "$BIN/$t"; codesign -s - -f "$BIN/$t" >/dev/null 2>&1
    done
  else echo "ffmpeg yok: sudo apt install ffmpeg"; fi
fi
if ! ffprobe -version >/dev/null 2>&1; then
  M="ffmpeg kurulamadı, MP3'e çevrilemez. İnternet bağlantısını kontrol edip tekrar aç."
  [ $GUI = 1 ] && osascript -e "display alert \"Müzik İndir\" message \"$M\"" || echo "$M"; exit 1
fi
yt-dlp -U >/dev/null 2>&1   # YouTube sık değişiyor, her açılışta güncelle

# Daha önce webm olarak kalanları MP3'e çevir
for w in "$OUT"/*.webm; do
  [ -e "$w" ] || continue
  echo "Çevriliyor: $(basename "$w")"
  ffmpeg -loglevel error -y -i "$w" -vn -b:a 320k "${w%.webm}.mp3" && rm "$w"
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

LINK="$1"
while :; do
  [ -z "$LINK" ] && LINK=$(ask)
  [ -z "$LINK" ] && exit 0
  case "$(fmt)" in
    Orijinal*) A=(-f "bestaudio[ext=m4a]/bestaudio" -x --audio-format m4a) ;;
    *)         A=(-x --audio-format mp3 --audio-quality 320K) ;;
  esac
  echo "İndiriliyor → $OUT"
  if yt-dlp "${A[@]}" --embed-thumbnail --add-metadata --ignore-errors -o "$OUT/%(title)s.%(ext)s" "$LINK"; then
    MSG="Bitti ✓"; else MSG="Bazı parçalar inmedi, terminale bak"; fi
  if [ $GUI = 1 ]; then
    osascript -e "display notification \"$MSG\" with title \"Müzik İndir\""; open "$OUT"
  else echo "$MSG"; fi
  LINK=""
done
