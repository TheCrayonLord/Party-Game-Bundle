// Checks that a phone that drops and comes back gets its seat back, in the lobby and mid-game.
// Usage: node tests/reconnect.mjs     (needs `npm run dev` running)
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const base = process.env.BASE || 'http://localhost:5173';
const browser = await chromium.launch();
const host = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await host.goto(`${base}/?menu=list&bots=2`);
const code = (await host.textContent('.code')).trim();
const phoneContext = await browser.newContext({ ...devices['iPhone 13'] });

const join = async () => {
  const p = await phoneContext.newPage();
  await p.goto(`${base}/play.html?room=${code}&net=r`);
  await p.fill('input[placeholder="Your name"]', 'Dropper');
  await p.click('text=Get my ticket');
  await p.waitForSelector('.ticket');
  return p;
};

let phone = await join();
await host.waitForFunction(() => document.querySelectorAll('.guest').length === 3);
await phone.close(); // the phone locks or the tab is closed
await host.waitForSelector('.guest.away');
const keptSeat = (await host.$$('.guest')).length === 3;

phone = await join(); // and comes back
await host.waitForFunction(() => !document.querySelector('.guest.away'));
const guests = (await host.$$('.guest')).length;

// Mid-game: start a game, leave, return, and expect the game screen instead of the lobby.
await phone.click('.opt:has-text("Fib Finder")');
await phone.click('.opt:has-text("Got it")', { timeout: 15000 }); // dismiss the how-to-play page
await phone.waitForSelector('textarea', { timeout: 15000 });
await phone.close();
phone = await join();
const midGame = await phone.waitForSelector('textarea', { timeout: 5000 }).then(() => true, () => false);

const ok = keptSeat && guests === 3 && midGame;
console.log(ok ? 'PASS reconnect' : `FAIL reconnect (guests=${guests}, midGame=${midGame})`);
await browser.close();
process.exit(ok ? 0 : 1);
