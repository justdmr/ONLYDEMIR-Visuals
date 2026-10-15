// Headless test: opens the app in a fresh Chromium profile (your saved settings are never touched), visits scenes,
// saves screenshots and reports console / page errors.
// usage: node tools/shoot.mjs [--url=http://127.0.0.1:8766/index.html] [--size=1280x720] [--scenes=p_neon,p_car|all]
//                             [--shots=3] [--every=1500] [--out=shots] [--drop]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const arg = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const url = arg.url || 'http://127.0.0.1:8766/index.html';
const [W, H] = (arg.size || '1280x720').split('x').map(Number);
const shots = +(arg.shots || 1), every = +(arg.every || 1500), out = arg.out || 'shots';
fs.mkdirSync(out, { recursive: true });

const browser = await pw.chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
// missing photo scenes are probed with HEAD requests; their 404s are expected
page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/status of 404/.test(m.text())) errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
page.on('requestfailed', r => { if (r.method() !== 'HEAD') errors.push('[requestfailed] ' + r.url()); });
page.on('response', r => { if (r.status() >= 400 && r.request().method() !== 'HEAD') errors.push(`[http ${r.status()}] ${r.url()}`); });

await page.goto(url);
await page.waitForFunction(() => window.__odv && document.getElementById('loading').classList.contains('done'), null, { timeout: 120000 });
await page.evaluate(() => { document.getElementById('ui').classList.add('hidden'); document.body.classList.add('idle'); const o = window.__odv.S; o.auto = 'off'; o.lock = true; o.sting = false; });
const list = await page.evaluate(() => window.__odv.scenes.map((s, i) => ({ i, key: s.key, name: s.name })));
const want = !arg.scenes || arg.scenes === 'all' ? list : list.filter(s => arg.scenes.split(',').includes(s.key));
const report = [];
for (const s of want) {
  const before = errors.length;
  await page.evaluate(i => window.__odv.setScene(i, 0.05), s.i);
  await page.waitForTimeout(every);
  for (let k = 0; k < shots; k++) {
    if (arg.drop && k === shots - 1) { await page.evaluate(() => window.__odv.doDrop()); await page.waitForTimeout(400); }
    const file = `${out}/${String(s.i).padStart(2, '0')}_${s.key}${shots > 1 ? '_' + k : ''}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
    if (k < shots - 1) await page.waitForTimeout(every);
  }
  const fps = await page.evaluate(() => document.getElementById('fps').textContent);
  report.push({ ...s, fps, errors: errors.slice(before) });
  console.log(`${s.i.toString().padStart(2)} ${s.key.padEnd(14)} ${s.name.padEnd(22)} ${fps.padStart(7)} ${errors.length - before ? 'ERR ' + errors.slice(before).join(' | ') : 'ok'}`);
}
if (errors.length) console.log('\nall errors:\n' + [...new Set(errors)].join('\n'));
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
await browser.close();
