# Party Game Bundle

A phone-controlled party game pack with a retro theme-park feel. One computer hosts the game in a browser (put it on a TV); everyone else scans a QR code and plays from their phone's browser. No app, no accounts.

- Design and roadmap: [PLAN.md](PLAN.md)
- Mascot ideas: [MASCOTS.md](MASCOTS.md)
- Music samples: [audio-samples/](audio-samples)

## Try it

```bash
npm install
npm run dev
```

Open the **Network** address that Vite prints (not `localhost`) on the host computer, then scan the QR code with a phone on the same Wi-Fi.

- **No phones handy?** Click **+ Add a bot** in the lobby, or open `/?bots=7` to fill the room. Bots play every game.
- **Tilt steering needs HTTPS.** Over plain `http://` on your home network, phones fall back to drag-to-steer. Deploy to GitHub Pages (below) to get real tilt.
- Press **Esc** on the host to leave a game. Click a guest in the lobby to remove them.

## Putting it online

Phones need an `https://` address for tilt, and players shouldn't have to be on the same Wi-Fi. Two ways:

1. **GitHub Pages (no server).** In the repository settings choose Pages → Source: *GitHub Actions*, then push to `main`. The included workflow builds and publishes the game. Phones connect to the host directly (WebRTC, using the free public PeerJS service for the handshake).
2. **Your own small server.** `npm run build && npm run serve` serves the game and a relay from one port (`PORT`, default 8080). Put it behind HTTPS on any Node host. Phones then connect through the relay, which works on networks where a direct connection can't be made.

The game picks automatically: if the page is served by the relay server it uses the relay, otherwise WebRTC.

## Build status

| | |
|---|---|
| Lobby, QR join, room codes, player tickets | Done (plain menu; the 3D park hub comes later) |
| Reconnect after a phone sleeps or reloads | Done, also mid-game |
| Host player controls the menu from their phone | Done |
| Bots | Done |
| Prize tickets across games | Done (no end-of-night ceremony yet) |
| WebRTC transport and relay transport | Both work; automatic fall-back from one to the other mid-session is not built yet |
| Sound | None yet: waiting on a decision about the samples |

### Games

| Zone | Game | Players | State |
|---|---|---|---|
| Speedway | Tilt Kart | 2–12 | Playable: 2 tracks, 3 items, bots |
| Speedway | Snail Sprint | 2–12 | Playable |
| Art Alley | Sketch & Switch | 3–12 | Playable |
| Art Alley | Fake Artist | 4–10 | Playable |
| Midway | Fib Finder | 3–12 | Playable: 26 questions |
| Midway | Punchline Duel | 3–12 | Playable: 40 prompts |
| Haunted Manor | Heist Crew | 2–12 | Playable: 4 lock types, one crew |
| Haunted Manor | Dungeon Vote | 4–12 | Playable: 14 rooms |

Not started: Riptide Regatta, Sky Slalom, Hot Potato Bomb, Draw Your Racer, Logo Lab, Secret Agent, the 3D park hub, regular/performance start.

**Not yet tested on real phones.** Everything above has been played end-to-end by automated browsers pretending to be phones, and with a full room of 12 bots. Tilt on real devices, how the games feel, and difficulty balance all still need a real play session.

## How it's put together

```
index.html, play.html     the TV page and the phone page
src/core/                 networking, shared types, helpers
src/host/                 lobby, players, scoring, and the toolkit games use (ctx.ts)
src/controller/           the phone: join screen and every kind of controller screen (kit.ts)
src/games/                one file per game, plus content/ for prompts and questions
server/                   the small relay server
tests/                    automated play-throughs
```

The TV runs all the game logic. Each phone is told which screen to show (a text box, a vote, a drawing pad, a tilt pad…) and sends back what the player does. Because those screens are shared, most games are a single file of TV-side code and need no phone code at all. To add a game, write a file in `src/games/` and add it to the list in `src/games/index.ts`.

## Tests

With `npm run dev` running in another terminal:

```bash
node tests/smoke.mjs fib 3 1 4     # game id, phones, bots, speed-up
node tests/bots.mjs 12 6           # every game with a full room of bots
node tests/reconnect.mjs           # a phone drops and comes back
```
