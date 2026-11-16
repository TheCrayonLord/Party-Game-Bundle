// A thirteenth guest joins the audience: they can cheer and vote. Also checks "Play again" on the results screen,
// and that a tilt controller keeps its layout when the phone is turned on its side.
// Usage: node tests/audience.mjs     (needs `npm run dev` running; set SHOTS=dir for screenshots)
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const base = process.env.BASE || 'http://localhost:5173';
const shots = process.env.SHOTS;
const browser = await chromium.launch();
const errors = [], checks = [];
const check = (name, ok) => checks.push([name, !!ok]);
const host = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
host.on('pageerror', (e) => errors.push(e.message));
host.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await host.goto(`${base}/?menu=list&bots=12&speed=3`);
const code = (await host.textContent('.code')).trim();
const phone = await (await browser.newContext({ ...devices['Pixel 5'] })).newPage();
phone.on('pageerror', (e) => errors.push('phone: ' + e.message));
await phone.goto(`${base}/play.html?room=${code}&net=r`);
await phone.fill('input[placeholder="Your name"]', 'Watcher');
await phone.click('text=Get my ticket');
await phone.waitForSelector('text=You’re in the audience');
await host.waitForSelector('.audience-note');
check('audience listed in the lobby', /Watcher/.test(await host.textContent('.audience-note')));

await host.click('[data-game="punchline"]');
await phone.waitForSelector('.cheer', { timeout: 20000 });
await phone.click('.cheer >> nth=0');
await host.waitForSelector('.cheer-float', { timeout: 5000 }).then(() => check('cheer floats up the big screen', true), () => check('cheer floats up the big screen', false));
if (shots) { await host.screenshot({ path: `${shots}/cheer.png` }); await phone.screenshot({ path: `${shots}/cheer-phone.png` }); }
await host.keyboard.press('Space');       // skip the how-to page
await phone.waitForSelector('.opt', { timeout: 90000 });
check('audience gets the vote', /funnier/i.test(await phone.textContent('.screen')));
await phone.click('.opt >> nth=0');
await phone.waitForSelector('text=Vote counted!');
check('vote is counted', true);

await host.waitForSelector('.results', { timeout: 240000 });
await host.waitForSelector('.results.reveal', { timeout: 30000 });
await host.click('[data-next="again"]');
await host.waitForSelector('.game', { timeout: 10000 });
check('play again restarts the same ride', /Punchline/.test(await host.textContent('.hud-title')));

// Tilt layout on its side: a second room with a real seat for the phone.
const host2 = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await host2.goto(`${base}/?menu=list&bots=2`);
const code2 = (await host2.textContent('.code')).trim();
const ctx2 = await browser.newContext({ ...devices['Pixel 5'] });
const phone2 = await ctx2.newPage();
await phone2.goto(`${base}/play.html?room=${code2}&net=r`);
await phone2.fill('input[placeholder="Your name"]', 'Tilter');
await phone2.click('text=Get my ticket');
await phone2.click('.opt:has-text("Riptide Regatta")');
await phone2.click('.opt:has-text("Got it")', { timeout: 15000 });
await phone2.waitForSelector('.swipezone', { timeout: 30000 });
const size = phone2.viewportSize();
await phone2.setViewportSize({ width: size.height, height: size.width });       // the phone is turned onto its side
await phone2.waitForFunction(() => document.body.dataset.rot);
const box = await phone2.$eval('.swipezone', (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight }; });
check('boost control still on screen when turned', box.l >= -1 && box.t >= -1 && box.r <= box.w + 1 && box.b <= box.h + 1);
check('layout is turned back', /rotate/.test(await phone2.$eval('#app', (el) => el.style.transform || getComputedStyle(el).transform)) || (await phone2.$eval('#app', (el) => getComputedStyle(el).transform)) !== 'none');
if (shots) await phone2.screenshot({ path: `${shots}/turned.png` });

const bad = checks.filter(([, ok]) => !ok).map(([n]) => n);
const ok = !bad.length && !errors.length;
console.log(ok ? 'PASS audience' : 'FAIL audience', bad.length ? '| failed: ' + bad.join(', ') : '');
if (errors.length) console.log('ERRORS:', [...new Set(errors)].slice(0, 5).join(' | '));
await browser.close();
process.exit(ok ? 0 : 1);
