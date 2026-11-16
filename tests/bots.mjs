// Fills the room with bots and plays every game to the results screen.
// Usage: node tests/bots.mjs [bots=12] [speed=6] [gameId...]     (needs `npm run dev` running)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const [bots = '12', speed = '6', ...only] = process.argv.slice(2);
const base = process.env.BASE || 'http://localhost:5173';
const all = [['tiltkart', 12], ['regatta', 12], ['snail', 12], ['sketch', 12], ['fakeartist', 10], ['drawracer', 12], ['logolab', 12], ['fib', 12], ['punchline', 12], ['heist', 12], ['dungeon', 12]];
const browser = await chromium.launch();
let failed = 0;
for (const [game, max] of all.filter(([g]) => !only.length || only.includes(g))) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const t0 = Date.now();
  await page.goto(`${base}/?bots=${Math.min(Number(bots), max)}&speed=${speed}&game=${game}`);
  let ok = true;
  try { await page.waitForSelector('.results', { timeout: 300000 }); } catch { ok = false; }
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/bots-${game}.png` });
  const rows = ok ? await page.$$eval('.result-row', (r) => r.length) : 0;
  console.log(`${ok && !errors.length ? 'PASS' : 'FAIL'} ${game}: ${rows} players, ${Math.round((Date.now() - t0) / 1000)}s${errors.length ? ' ERRORS: ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`);
  if (!ok || errors.length) failed++;
  await page.context().close();
}
await browser.close();
process.exit(failed ? 1 : 0);
