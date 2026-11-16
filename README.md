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
| Lobby, QR join, room codes, player tickets | Done |
| Two ways to start | **Regular start:** a walk-around carnival seen from above, with winding trails and a themed building for each game. Players appear at the gate in a puff of smoke, walk with arrows or by dragging on their phone, and pick a game by standing at it; when more than half the park is at one ride it starts, and a tie between the leading rides is settled at random. **Performance start:** the plain list, where the host player picks. Switch any time with the button in the lobby |
| Reconnect after a phone sleeps or reloads | Done, also mid-game |
| Host player controls the menu from their phone | Done |
| Bots | Done |
| Prize tickets across games | Done (no end-of-night ceremony yet) |
| WebRTC transport and relay transport | Both work; automatic fall-back from one to the other mid-session is not built yet |
| Sound | None yet: waiting on a decision about the samples |
| How-to-play page | Shown before the first match of each game in a session; the host player taps to continue |
| Bot skill | Easy / Normal / Hard button in the lobby (affects the racing, flying, snail, trivia and ghost-train bots) |
| Placements screen | After every game: a podium revealed third to first, then the table with prize tickets and arrows showing who moved up or down overall. Team and hidden-role games get a banner instead |
| Mascot | Gus the Goldfish, Sprocket the Strongman Bear, Colonel Kernel and Madame Bulb take turns hosting, one per session (emoji stand-ins and speech bubbles for now). They remark on lead changes, crashes, eliminations and whoever is stuck in last during games, and on winners, streaks and close rivalries afterwards. Click the mascot in the lobby to swap, or add `?mascot=gus`, `sprocket`, `kernel` or `bulb` |

### Games

All 14 games from the plan are playable.

| Zone | Game | Players | Notes |
|---|---|---|---|
| Speedway | Tilt Kart | 2–12 | 6 themed tracks (host picks), 3 items, 3 laps |
| Speedway | Sky Slalom | 2–12 | 22 hoops, gold centres, gusts of wind |
| Speedway | Downhill Dash | 2–12 | Third-person ski race, each skier in their own part of the screen. Four at a time; bigger groups race in heats and the best times win. 3 hills including a night run |
| Speedway | Snail Sprint | 2–12 | |
| Lagoon | Riptide Regatta | 2–12 | Shares Tilt Kart's engine. Open water, 6 themed courses marked by buoys, including a night course where each boat carries a lamp; waves, whirlpools, currents, rocks, swipe to boost |
| Art Alley | Sketch & Switch | 3–12 | |
| Art Alley | Fake Artist | 4–10 | |
| Art Alley | Logo Lab | 3–12 | 30 companies |
| Midway | Fib Finder | 3–12 | 26 questions |
| Midway | Punchline Duel | 3–12 | 40 prompts |
| Midway | Hot Potato Bomb | 3–12 | |
| Fortune Tent | Secret Agent | 4–10 | 18 locations, one spy |
| Haunted Manor | Heist Crew | 2–12 | 4 lock types, one crew |
| Haunted Manor | Dungeon Vote | 4–12 | 14 rooms |

Not started: the end-of-night prize ceremony, the camera swoop into a ride, sound, and everything in the backlog.

Simplified for now compared with the plan: Riptide Regatta has no "pass the buoy on the correct side" rule (straying outside the buoys just slows you); Sky Slalom has no speed gain from diving; Hot Potato's eliminated players get one fuse-shortening tap; Secret Agent always has one spy; Heist Crew has one crew at any size.

**Not yet tested on real phones.** Everything above has been played end-to-end by automated browsers pretending to be phones, and with a full room of bots. Tilt, swipe and flick on real devices, how the games feel, and difficulty balance all still need a real play session.

## How it's put together

```
index.html, play.html     the TV page and the phone page
src/core/                 networking, shared types, helpers
src/host/                 lobby, players, scoring, and the toolkit games use (ctx.ts)
src/controller/           the phone: join screen and every kind of controller screen (kit.ts)
src/games/                one file per game, plus content/ for prompts and questions;
                          racing.ts is the engine shared by the three racing games
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
node tests/park.mjs                # walk-around park: join, walk to a ride, game starts
```
