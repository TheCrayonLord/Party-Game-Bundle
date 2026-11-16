// End-to-end smoke test: opens the host page, joins real phone pages, plays a whole game.
// Usage: node tests/smoke.mjs <gameId> [phones=3] [bots=1] [speed=4]     (needs `npm run dev` running)
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const [game = 'fib', phonesN = '3', bots = '1', speed = '4'] = process.argv.slice(2);
const base = process.env.BASE || 'http://localhost:5173';
const shot = process.env.SHOTS; // directory for screenshots
const browser = await chromium.launch();
const errors = [];
const watch = (page, who) => {
  page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${who} console: ${m.text()}`); });
};

const hostPage = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
watch(hostPage, 'host');
const extra = process.env.EXTRA || ''; // e.g. net=p&peerhost=localhost&peerport=9000 to test WebRTC
await hostPage.goto(`${base}/?menu=list&bots=${bots}&speed=${speed}&${extra}`);
await hostPage.waitForSelector('.code');
const code = (await hostPage.textContent('.code')).trim();
console.log('room', code);

const phones = [];
for (let i = 0; i < Number(phonesN); i++) {
  const c = await browser.newContext({ ...devices['Pixel 5'] });
  const p = await c.newPage();
  watch(p, 'phone' + i);
  await p.goto(`${base}/play.html?room=${code}&${extra || 'net=r'}`);
  await p.fill('input[placeholder="Your name"]', 'Tester' + (i + 1));
  await p.click('text=Get my ticket');
  await p.waitForSelector('.ticket');
  phones.push(p);
}
await hostPage.waitForFunction((n) => document.querySelectorAll('.guest').length === n, Number(phonesN) + Number(bots));
if (shot) { await hostPage.screenshot({ path: `${shot}/lobby.png` }); await phones[0].screenshot({ path: `${shot}/phone-lobby.png` }); }

// The first phone is the host player: pick the game from the phone.
await phones[0].click(`.opt:has-text("${await hostPage.textContent(`[data-game="${game}"] .ride-name`)}")`);
await hostPage.waitForSelector('.game');
console.log('game started');

// Each phone plays automatically: answers whatever screen it is shown.
let playing = true;
const autoplay = async (p, i) => {
  let n = 0;
  while (playing) {
    try {
      await p.evaluate(async (i) => {
        const s = document.querySelector('.screen'); if (!s) return;
        if (/Pick an attraction/.test(s.querySelector('h2')?.textContent || '') || [...s.querySelectorAll('.opt')].some((o) => o.textContent === 'Back to the park')) return; // leave menus and the results screen alone
        const ta = s.querySelector('textarea');
        if (ta && !ta.disabled) { ta.value = 'answer ' + i + ' ' + Math.floor(Math.random() * 1000); ta.dispatchEvent(new Event('input')); s.querySelector('.btn').click(); return; }
        const canvas = s.querySelector('canvas');
        if (canvas && !canvas.dataset.drawn) {
          canvas.dataset.drawn = '1';
          const r = canvas.getBoundingClientRect();
          const ev = (t, x, y) => canvas.dispatchEvent(new PointerEvent(t, { clientX: r.left + r.width * x, clientY: r.top + r.height * y, pointerId: 1, bubbles: true }));
          canvas.setPointerCapture = () => {};
          ev('pointerdown', .2, .2); ev('pointermove', .5, .8); ev('pointermove', .8, .3); ev('pointerup', .8, .3);
          const done = [...s.querySelectorAll('.btn')].find((b) => b.textContent === 'Done'); if (done) done.click();
          return;
        }
        const inp = s.querySelector('.inline input');
        if (inp) { inp.value = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); s.querySelector('.inline .btn').click(); }
        const opts = [...s.querySelectorAll('.opt:not(:disabled)')];
        if (opts.length) opts[Math.floor(Math.random() * opts.length)].click();
        const bomb = s.querySelector('.bombpad');
        if (bomb) {
          bomb.setPointerCapture = () => {};
          bomb.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 300, pointerId: 1, bubbles: true }));
          bomb.dispatchEvent(new PointerEvent('pointerup', { clientX: 320, clientY: 300, pointerId: 1, bubbles: true }));
        }
        const pad = s.querySelector('.tiltpad, .rubpad');
        if (pad) {
          pad.setPointerCapture = () => {};
          const r = pad.getBoundingClientRect();
          const ev = (t, x, y) => pad.dispatchEvent(new PointerEvent(t, { clientX: r.left + r.width * x, clientY: r.top + r.height * y, pointerId: 1, bubbles: true }));
          ev('pointerdown', .3, .5); ev('pointermove', .3 + Math.random() * .4, .5); if (pad.className === 'rubpad') ev('pointermove', .2, .6);
          const b = s.querySelector('.bigbtn'); if (b && Math.random() < .2) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        }
      }, i);
    } catch { /* page navigating */ }
    if (shot && i === 0 && n++ % 25 === 0) await p.screenshot({ path: `${shot}/phone-${game}-${n}.png` }).catch(() => {});
    await p.waitForTimeout(250);
  }
};
const loops = phones.map(autoplay);

const t0 = Date.now();
let n = 0;
const timeout = Number(process.env.TIMEOUT || 240) * 1000;
while (Date.now() - t0 < timeout) {
  if (await hostPage.$('.results')) break;
  if (shot && n++ % 8 === 0) await hostPage.screenshot({ path: `${shot}/${game}-${String(n).padStart(3, '0')}.png` });
  await hostPage.waitForTimeout(1000);
}
const ok = !!(await hostPage.$('.results'));
if (shot) await hostPage.screenshot({ path: `${shot}/${game}-results.png` });
if (ok) console.log('results:', (await hostPage.$$eval('.result-row', (r) => r.map((x) => x.textContent.replace(/\s+/g, ' ')))).join(' | '));
playing = false; await Promise.all(loops);
await browser.close();
console.log(ok ? `PASS ${game} in ${Math.round((Date.now() - t0) / 1000)}s` : `FAIL ${game}: no results screen`);
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 15).join('\n'));
process.exit(ok && !errors.length ? 0 : 1);
