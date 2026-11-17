// The walk-around park: phones join, walk to a ride, and the game starts when most of the park is standing there.
// Usage: node tests/park.mjs     (needs `npm run dev` running; set SHOTS=dir for screenshots)
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const base = process.env.BASE || 'http://localhost:5173';
const shots = process.env.SHOTS;
const browser = await chromium.launch();
const errors = [];
const host = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
host.on('pageerror', (e) => errors.push(e.message));
host.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Start screen -> regular start.
await host.goto(`${base}/?bots=3`);
if (shots) await host.screenshot({ path: `${shots}/start.png` });
await host.click('[data-menu="park"]');
await host.waitForSelector('.park-canvas');
const code = (await host.textContent('.code')).trim();

const phones = [];
for (let i = 0; i < 2; i++) {
  const p = await (await browser.newContext({ ...devices['Pixel 5'] })).newPage();
  p.on('pageerror', (e) => errors.push('phone: ' + e.message));
  await p.goto(`${base}/play.html?room=${code}&net=r`);
  await p.fill('input[placeholder="Your name"]', 'Walker' + (i + 1));
  await p.click('text=Get my ticket');
  await p.waitForSelector('.walk-arrows');
  phones.push(p);
}
await host.waitForTimeout(600);
if (shots) { await host.screenshot({ path: `${shots}/park-arrive.png` }); await phones[0].screenshot({ path: `${shots}/park-phone.png` }); }

// Both walk up the main path and a step to the right, to the ride just beyond the plaza.
const hold = (p, dir, ms) => p.evaluate(async ([dir, ms]) => {
  const b = document.querySelector('.walk-arrow.' + dir);
  if (!b) return;      // the ride has already started and the walk pad is gone
  b.setPointerCapture = () => {};
  b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }));
  await new Promise((r) => setTimeout(r, ms));
  b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
}, [dir, ms]);
await Promise.all(phones.map((p) => hold(p, 'up', 1750)));
await Promise.all(phones.map((p) => hold(p, 'right', 270)));
await host.waitForTimeout(1500);
const banner = await host.textContent('.park-banner');
const phoneSays = await phones[0].textContent('[data-live="big"]');
if (shots) await host.screenshot({ path: `${shots}/park-vote.png` });

// On a slow machine the walkers fall a little short of the circle, so nudge them on until the ride starts.
let started = false;
for (let i = 0; i < 6 && !started; i++) {
  started = await host.waitForSelector('.game', { timeout: 8000 }).then(() => true, () => false);
  if (!started) await Promise.all(phones.map((p) => hold(p, 'up', 150)));
}
const title = started ? await host.textContent('.hud-title') : '';
const parkGone = !(await host.$('.park-canvas'));
const ok = started && parkGone && !errors.length;
console.log(ok ? 'PASS park' : 'FAIL park', '| banner:', banner, '| phone:', phoneSays, '| started:', title);
if (errors.length) console.log('ERRORS:', [...new Set(errors)].slice(0, 5).join(' | '));
await browser.close();
process.exit(ok ? 0 : 1);
