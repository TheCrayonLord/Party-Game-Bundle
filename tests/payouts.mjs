// Plays each game several times with bots and records who won how many tickets, to check the payouts.
// Usage: node tests/payouts.mjs <out.json> [runs=3] [bots=8] [speed=6] [gameId...]     (needs `npm run dev` running)
// Bots get mixed skill (a third each easy, normal, hard), so the results also show how much skill decides each game.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const [out, runs = '3', bots = '8', speed = '6', ...only] = process.argv.slice(2);
const base = process.env.BASE || 'http://localhost:5173';
const all = ['tiltkart', 'regatta', 'skyslalom', 'ski', 'snail', 'sketch', 'fakeartist', 'logolab', 'fib', 'punchline', 'hotpotato', 'agent', 'heist', 'dungeon'];
const browser = await chromium.launch();
const data = [];
for (const game of all.filter((g) => !only.length || only.includes(g))) {
  for (let run = 0; run < Number(runs); run++) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    const t0 = Date.now();
    await page.goto(`${base}/?menu=list&bots=${bots}&speed=${speed}`);
    await page.waitForSelector('.guest-skill');
    // Mixed skill: click bot i's skill label (Normal -> Hard -> Easy) i % 3 times.
    const n = await page.$$eval('.guest-skill', (e) => e.length);
    for (let i = 0; i < n; i++) for (let k = 0; k < i % 3; k++) await page.click(`.guest-skill >> nth=${i}`);
    const levels = await page.$$eval('.guest', (e) => Object.fromEntries(e.map((x) => [x.querySelector('.guest-name').textContent, x.querySelector('.guest-skill').textContent])));
    await page.click(`[data-game="${game}"]`);
    await page.waitForSelector('.howto', { timeout: 20000 }).catch(() => {});
    await page.keyboard.press('Space');
    let ok = true;
    try { await page.waitForSelector('.results', { timeout: 400000 }); } catch { ok = false; }
    const secs = Math.round((Date.now() - t0) / 1000);
    const rows = ok ? await page.$$eval('.result-row', (r) => r.map((x) => ({
      rank: x.querySelector('.result-rank').textContent, name: x.querySelector('.badge').textContent.replace(/^\S+\s/, ''),
      label: x.querySelector('.result-label').textContent, won: Number(x.querySelector('.result-tix').textContent.replace(/\D/g, '')) }))) : [];
    for (const r of rows) r.level = levels[r.name];
    const team = ok && await page.$('.results.team') != null;
    data.push({ game, run, secs, team, rows });
    console.log(`${game} #${run + 1}: ${ok ? rows.map((r) => `${r.rank || '-'}${r.level[0]}:${r.won}`).join(' ') : 'FAILED'} (${secs}s)`);
    writeFileSync(out, JSON.stringify(data));
    await page.context().close();
  }
}
await browser.close();
