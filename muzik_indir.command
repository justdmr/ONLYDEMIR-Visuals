#!/bin/bash
# Müzik İndir — Mac'te çift tıkla, tarayıcıda http://localhost:8777 açılır.
# Başka PC'de terminalden: bash muzik_indir.command  (adresi tarayıcıya yaz)
# İlk açılışta yt-dlp + ffmpeg + deno'yu ~/.muzik-indir klasörüne kurar.
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
[ "$1" = --update ] && { get_ytdlp; exit $?; }
PORT=8777; URL="http://localhost:$PORT"
op() { [ $MAC = 1 ] && open "$1" || { command -v xdg-open >/dev/null && xdg-open "$1" >/dev/null 2>&1; }; }

# Zaten açıksa sadece tarayıcıyı aç
curl -fs "$URL/api/places" >/dev/null 2>&1 && { op "$URL"; exit 0; }

# Haftada bir arka planda güncelle (açılışı yavaşlatmaz)
[ $(( $(date +%s) - $(cat "$BIN/updated" 2>/dev/null || echo 0) )) -gt 604800 ] && (get_ytdlp >/dev/null 2>&1 &)

cat > "$BIN/server.js" <<'JS'
const E = Deno.env.toObject(), MAC = Deno.build.os === "darwin", HOME = E.HOME;
const jobs = []; let nid = 1, busy = false;
const run = async (cmd, args) => { try { const o = await new Deno.Command(cmd, { args, stdout: "piped", stderr: "null" }).output(); return o.success ? new TextDecoder().decode(o.stdout).trim() : ""; } catch { return ""; } };
const exists = async p => { try { return (await Deno.stat(p)).isDirectory; } catch { return false; } };

async function places() {
  const l = [["İndirilenler/Muzik", E.OUT], ["Masaüstü", HOME + "/Desktop"], ["Müzik", HOME + "/Music"]];
  const roots = MAC ? ["/Volumes"] : ["/media/" + E.USER, "/run/media/" + E.USER];
  for (const r of roots) try { for await (const d of Deno.readDir(r)) if (d.name !== "Macintosh HD" && !d.name.startsWith(".")) l.push(["💾 " + d.name, r + "/" + d.name]); } catch {}
  const out = []; for (const [n, p] of l) if (await exists(p)) out.push({ name: n, path: p }); return out;
}

const FMT = {
  mp3:  ["-x", "--audio-format", "mp3", "--audio-quality", "320K"],
  mp3b: ["-x", "--audio-format", "mp3", "--audio-quality", "192K"],
  m4a:  ["-f", "bestaudio[ext=m4a]/bestaudio", "-x", "--audio-format", "m4a"],
  wav:  ["-x", "--audio-format", "wav"],
  flac: ["-x", "--audio-format", "flac"],
  mp4:  ["-f", "bv*[ext=mp4][height<=1080]+ba[ext=m4a]/b[ext=mp4]/b", "--merge-output-format", "mp4"],
};

function args(j) {
  const a = [...FMT[j.fmt], "--add-metadata", "--newline", "--ignore-errors", "--no-mtime"];
  if (!["wav", "mp4"].includes(j.fmt)) a.push("--embed-thumbnail");
  if (j.norm && j.fmt !== "mp4") a.push("--ppa", "ExtractAudio+ffmpeg_o:-af loudnorm=I=-11:TP=-1");
  if (j.trim) a.push("--download-sections", "*" + j.trim);
  a.push(j.list ? "--yes-playlist" : "--no-playlist");
  a.push("-o", j.dest + (j.list ? "/%(playlist_title|)s/%(playlist_index|)s%(playlist_index& - |)s%(title)s.%(ext)s" : "/%(title)s.%(ext)s"));
  a.push(/^https?:\/\//.test(j.url) ? j.url : "ytsearch1:" + j.url);   // link değilse YouTube'da ara
  return a;
}

async function work() {
  if (busy) return; busy = true;
  let j; while ((j = jobs.find(x => x.st === "sırada"))) {
    j.st = "iniyor";
    try {
      const p = new Deno.Command(E.Y, { args: args(j), stdout: "piped", stderr: "piped" }).spawn(); j.proc = p;
      const read = async s => { for await (const ch of s.pipeThrough(new TextDecoderStream())) for (const ln of ch.split(/\r?\n/)) {
        let m;
        if ((m = ln.match(/\[download\]\s+([\d.]+)%/))) j.pct = +m[1];
        else if ((m = ln.match(/Destination: (.+)$/))) j.title = m[1].split("/").pop().replace(/\.[^.]+$/, "");
        else if ((m = ln.match(/Downloading item (\d+) of (\d+)/))) j.item = m[1] + "/" + m[2];
        else if (/^\[(ExtractAudio|Merger|EmbedThumbnail|Metadata)\]/.test(ln)) j.st = "çevriliyor";
        else if (ln.startsWith("ERROR")) j.err = ln.slice(7, 220);
        if (j.st === "çevriliyor" && /\[download\]/.test(ln)) j.st = "iniyor";
      } };
      await Promise.all([read(p.stdout), read(p.stderr)]);
      const c = await p.status;
      j.st = j.st === "iptal" ? "iptal" : c.success ? "bitti" : (j.err ? "hata" : "bitti");
      if (j.st === "bitti") j.pct = 100;
    } catch (e) { j.st = "hata"; j.err = String(e); }
    delete j.proc;
    for await (const f of Deno.readDir(j.dest)) if (/\.(webp|jpg|part)$/.test(f.name) && j.st !== "bitti") Deno.remove(j.dest + "/" + f.name).catch(() => {});
  }
  busy = false;
}

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
Deno.serve({ hostname: "127.0.0.1", port: +E.PORT, onListen: () => console.log("Hazır → http://localhost:" + E.PORT) }, async req => {
  const u = new URL(req.url), b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  switch (u.pathname) {
    case "/": return new Response(await Deno.readTextFile(E.BIN + "/index.html"), { headers: { "content-type": "text/html; charset=utf-8" } });
    case "/api/places": return json(await places());
    case "/api/pick": {
      const p = MAC ? await run("osascript", ["-e", 'POSIX path of (choose folder with prompt "İndirilecek klasörü seç")'])
                    : await run("zenity", ["--file-selection", "--directory"]);
      return json({ path: p.replace(/\/$/, "") });
    }
    case "/api/add": {
      if (!(await exists(b.dest))) return json({ err: "Klasör bulunamadı: " + b.dest }, 400);
      for (const url of String(b.urls || "").split(/\n/).map(s => s.trim()).filter(Boolean))
        jobs.push({ id: nid++, url, fmt: FMT[b.fmt] ? b.fmt : "mp3", dest: b.dest, list: !!b.list, norm: !!b.norm, trim: /^[\d:]+-[\d:]+$/.test(b.trim || "") ? b.trim : "", st: "sırada", pct: 0 });
      work(); return json({ ok: 1 });
    }
    case "/api/jobs": return json(jobs.map(({ proc, ...j }) => j));
    case "/api/cancel": { const j = jobs.find(x => x.id === b.id); if (j) { j.st = "iptal"; try { j.proc?.kill(); } catch {} } return json({ ok: 1 }); }
    case "/api/clear": { for (let i = jobs.length; i--;) if (!["iniyor", "çevriliyor", "sırada"].includes(jobs[i].st)) jobs.splice(i, 1); return json({ ok: 1 }); }
    case "/api/open": await run(MAC ? "open" : "xdg-open", [b.path]); return json({ ok: 1 });
    case "/api/update": { const ok = await new Deno.Command("bash", { args: [E.SELF, "--update"] }).output(); return json({ ok: ok.success }); }
  }
  return new Response("yok", { status: 404 });
});
JS

cat > "$BIN/index.html" <<'HTML'
<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Müzik İndir</title><style>
:root{--bg:#0d0d10;--card:#17171c;--line:#2a2a33;--tx:#ececf1;--mu:#8b8b98;--ac:#e53935;--ok:#43a047}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.4 -apple-system,system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:28px 16px}h1{font-size:22px;margin:0 0 18px;letter-spacing:.5px}h1 b{color:var(--ac)}
.c{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px}
label{display:block;color:var(--mu);font-size:12px;text-transform:uppercase;letter-spacing:.6px;margin:0 0 6px}
textarea,input,select{width:100%;background:#0f0f13;color:var(--tx);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit}
textarea{min-height:84px;resize:vertical}.row{display:flex;gap:10px;flex-wrap:wrap}.row>*{flex:1;min-width:150px}
.seg{display:flex;flex-wrap:wrap;gap:6px}.seg button,.chip{background:#0f0f13;border:1px solid var(--line);color:var(--tx);border-radius:999px;padding:7px 12px;cursor:pointer;font:inherit;font-size:13px}
.seg button.on,.chip.on{background:var(--ac);border-color:var(--ac)}
.go{width:100%;background:var(--ac);color:#fff;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:700;cursor:pointer;margin-top:4px}
.sm{background:none;border:1px solid var(--line);color:var(--mu);border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12px}
.chk{display:flex;align-items:center;gap:8px;color:var(--tx);text-transform:none;font-size:14px;letter-spacing:0;margin:0}.chk input{width:auto}
.job{padding:10px 0;border-top:1px solid var(--line)}.job:first-child{border:0}.jt{display:flex;justify-content:space-between;gap:8px;align-items:center}
.nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st{color:var(--mu);font-size:12px;white-space:nowrap}
.bar{height:5px;background:#24242c;border-radius:4px;margin-top:6px;overflow:hidden}.bar i{display:block;height:100%;background:var(--ac);transition:width .3s}
.bitti .bar i{background:var(--ok)}.err{color:#ff8a80;font-size:12px;margin-top:4px}.hint{color:var(--mu);font-size:12px;margin-top:6px}
</style></head><body><main>
<h1>MÜZİK <b>İNDİR</b></h1>
<div class="c"><label>Link(ler) ya da şarkı adı — her satıra bir tane</label>
<textarea id="u" placeholder="https://youtube.com/watch?v=...&#10;Artist - Şarkı adı"></textarea>
<div class="hint">Link yerine şarkı adı yazarsan YouTube'da arayıp ilk sonucu indirir.</div></div>
<div class="c"><label>Format</label><div class="seg" id="fmt">
<button data-v="mp3" class="on">MP3 320</button><button data-v="mp3b">MP3 192</button><button data-v="m4a">M4A orijinal</button>
<button data-v="wav">WAV (CDJ)</button><button data-v="flac">FLAC</button><button data-v="mp4">Video MP4</button></div></div>
<div class="c"><label>Nereye — USB takınca burada çıkar</label><div class="seg" id="pl"></div>
<div class="row" style="margin-top:10px"><input id="dest"><button class="sm" style="flex:0" onclick="pick()">Klasör seç…</button><button class="sm" style="flex:0" onclick="places()">↻</button></div></div>
<div class="c"><label>Araçlar</label><div class="row">
<label class="chk"><input type="checkbox" id="list"> Playlist'in tamamı</label>
<label class="chk"><input type="checkbox" id="norm"> Ses seviyesini eşitle</label>
<div><input id="trim" placeholder="Kes: 1:00-2:30 (boş = tamamı)"></div></div></div>
<button class="go" onclick="add()">İNDİR</button>
<div class="c" style="margin-top:14px"><div class="jt"><label style="margin:0">İndirmeler</label><span>
<button class="sm" onclick="api('open',{path:$('dest').value})">Klasörü aç</button>
<button class="sm" onclick="api('clear')">Temizle</button>
<button class="sm" id="up" onclick="upd()">yt-dlp güncelle</button></span></div><div id="jobs"><div class="hint">Henüz yok.</div></div></div>
</main><script>
const $=id=>document.getElementById(id);let fmt=localStorage.mfmt||"mp3";
const api=(p,b)=>fetch("/api/"+p,b?{method:"POST",body:JSON.stringify(b)}:{method:p=="jobs"||p=="places"?"GET":"POST",body:p=="jobs"||p=="places"?undefined:"{}"}).then(r=>r.json());
document.querySelectorAll("#fmt button").forEach(b=>{b.classList.toggle("on",b.dataset.v==fmt);b.onclick=()=>{fmt=localStorage.mfmt=b.dataset.v;document.querySelectorAll("#fmt button").forEach(x=>x.classList.toggle("on",x==b))}});
$("dest").oninput=()=>{localStorage.mdest=$("dest").value;mark()};
function mark(){document.querySelectorAll("#pl .chip").forEach(c=>c.classList.toggle("on",c.dataset.p==$("dest").value))}
async function places(){const l=await api("places");$("pl").innerHTML="";l.forEach(p=>{const c=document.createElement("button");c.className="chip";c.textContent=p.name;c.dataset.p=p.path;c.onclick=()=>{$("dest").value=localStorage.mdest=p.path;mark()};$("pl").append(c)});
 if(!$("dest").value)$("dest").value=localStorage.mdest||l[0].path;mark()}
async function pick(){const r=await api("pick");if(r.path){$("dest").value=localStorage.mdest=r.path;mark()}}
async function add(){if(!$("u").value.trim())return $("u").focus();const r=await api("add",{urls:$("u").value,fmt,dest:$("dest").value,list:$("list").checked,norm:$("norm").checked,trim:$("trim").value.trim()});
 if(r.err)return alert(r.err);$("u").value="";poll()}
async function upd(){$("up").textContent="güncelleniyor…";const r=await api("update");$("up").textContent=r.ok?"güncel ✓":"olmadı";}
const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[c]);
async function poll(){const j=await api("jobs");$("jobs").innerHTML=j.length?j.slice().reverse().map(x=>`<div class="job ${x.st}"><div class="jt"><span class="nm">${esc(x.title||x.url)}</span><span class="st">${x.item?x.item+" · ":""}${x.st}${x.st=="iniyor"?" "+Math.round(x.pct)+"%":""} ${["sırada","iniyor","çevriliyor"].includes(x.st)?`<button class="sm" onclick="api('cancel',{id:${x.id}})">✕</button>`:""}</span></div><div class="bar"><i style="width:${x.pct}%"></i></div>${x.err?`<div class="err">${esc(x.err)}</div>`:""}</div>`).join(""):'<div class="hint">Henüz yok.</div>'}
places();poll();setInterval(poll,1000);
</script></body></html>
HTML

echo "Müzik İndir açılıyor → $URL   (kapatmak için bu pencereyi kapat)"
(sleep 1; op "$URL") &
OUT="$OUT" BIN="$BIN" Y="$Y" PORT=$PORT SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")" exec deno run -A --quiet "$BIN/server.js"
