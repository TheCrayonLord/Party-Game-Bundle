// The pause menu, settings, per-bot skill, and the closing ceremony (curtains, podium, bear, credits).
// Usage: node tests/pause.mjs     (needs `npm run dev` running; set SHOTS=dir for screenshots)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.env.BASE || 'http://localhost:5173';
const shots = process.env.SHOTS;
const snap = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const browser = await chromium.launch();
const errors = [], checks = [];
const check = (name, ok) => { checks.push([name, !!ok]); };
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Lobby: each bot has its own skill.
await page.goto(`${base}/?menu=list&bots=4&speed=4`);
await page.waitForSelector('.guest-skill');
await page.click('.guest-skill >> nth=0');
await page.waitForFunction(() => document.querySelector('.guest-skill')?.textContent === 'Hard');
const levels = await page.$$eval('.guest-skill', (e) => e.map((x) => x.textContent));
check('one bot changed on its own', levels[0] === 'Hard' && levels[1] === 'Normal');

// Play one quick game so the credits have something to say, pausing in the middle.
await page.click('[data-game="skyslalom"]');
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForFunction(() => /Hoops left: (20|19)/.test(document.querySelector('.kart-board')?.textContent || ''), null, { timeout: 60000 });   // hoops pass every two seconds
await page.keyboard.press('Escape');
await page.waitForSelector('.pause');
check('four main options', (await page.$$('.pause-opt')).length === 4);
const frozen = async () => { const a = await page.textContent('.kart-board'); await page.waitForTimeout(3200); return a === await page.textContent('.kart-board'); };
check('game stands still while paused', await frozen());
await snap(page, 'pause');
await page.click('[data-pause="settings"]');
await page.waitForSelector('[data-vol="master"]');
await page.$eval('[data-vol="music"]', (el) => { el.value = '35'; el.dispatchEvent(new Event('input')); });
await page.click('.set-row.bot >> nth=1 >> text=Easy');
await snap(page, 'settings');
check('volume saved', await page.evaluate(() => JSON.parse(localStorage.getItem('pgb-settings')).volume.music === 35));
await page.keyboard.press('Escape');            // back to the main page
await page.waitForSelector('[data-pause="resume"]');
await page.keyboard.press('Escape');            // resume
await page.waitForSelector('.pause', { state: 'detached' });
check('game moves again after resume', !(await frozen()));
await page.waitForSelector('.results', { timeout: 120000 });

// End game from the results screen.
await page.keyboard.press('Escape');
await page.click('[data-pause="end"]');
await page.waitForSelector('.curtain.closed');
await page.waitForTimeout(700);
await snap(page, 'curtain');
await page.waitForSelector('.bear.drop', { timeout: 30000 });
await page.waitForSelector('.finale-banner.show');
await page.waitForTimeout(400);
await snap(page, 'bear');
const banner = await page.textContent('.finale-banner');
await page.waitForSelector('.credits-roll', { timeout: 30000 });
await page.waitForTimeout(1800);
await snap(page, 'credits');
const creditText = await page.textContent('.credits-roll');
check('credits mention the ride', /Sky Slalom/.test(creditText) && /Grand prize/.test(creditText));
await page.waitForSelector('[data-finale="fresh"]', { timeout: 60000 });
await snap(page, 'endcard');
await page.click('[data-finale="fresh"]');
await page.waitForSelector('.guest');
check('tickets reset for a new night', (await page.$$eval('.guest-meta', (e) => e.every((x) => / 0 🎟️/.test(x.textContent)))));
check('curtain gone', !(await page.$('.curtain')));

// Return to desktop.
await page.keyboard.press('Escape');
await page.click('[data-pause="desktop"]');
await page.waitForSelector('text=You can close this tab now', { timeout: 5000 }).catch(() => {});
check('park closed screen', page.isClosed() || await page.$('text=You can close this tab now'));

const bad = checks.filter(([, ok]) => !ok).map(([n]) => n);
const ok = !bad.length && !errors.length;
console.log(ok ? 'PASS pause' : 'FAIL pause', '| banner:', banner, bad.length ? '| failed: ' + bad.join(', ') : '');
if (errors.length) console.log('ERRORS:', [...new Set(errors)].slice(0, 5).join(' | '));
await browser.close();
process.exit(ok ? 0 : 1);
