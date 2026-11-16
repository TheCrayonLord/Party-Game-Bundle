# Party Game Bundle — Design & Production Plan

A phone-controlled party game pack. One computer hosts in a browser (on a TV); 8–12 players join by QR code and use their phones as controllers. No app, no accounts.

---

## 1. Design pillars

Every decision below is checked against these.

1. **Playing in 30 seconds.** Scan, type a name, you're in. No installs, no accounts, no tutorials longer than one screen.
2. **Eyes up.** The TV is the game; the phone is a controller. Phone screens show only what you need to *act* (buttons, your secret, your drawing), never something you need to *watch*, except in games built on hidden information.
3. **The room is the game.** The best moments are people yelling at each other. Favor mechanics that create talking, accusing, laughing and gloating over mechanics that reward silent skill.
4. **Nobody waits long.** Rounds are 60–120 s. Eliminated or idle players always have something to do (vote, heckle, sabotage, bet).
5. **Readable at 12 players.** Every player has a color **and** a shape **and** a name. Anything on the TV must be legible from a couch with 12 things moving.

---

## 2. Key technical decisions

### 2.1 The HTTPS constraint decides the networking order

Tilt (`DeviceOrientation`) only works on a secure page. A Node server on the host PC serves `http://192.168.x.x`, which is **not** secure, so tilt would be dead on every phone. And a page loaded over HTTPS cannot open a plain `ws://` socket to a LAN machine (mixed content). This shapes everything:

| Option | HTTPS? | Verdict |
|---|---|---|
| **Static site on HTTPS hosting (e.g. GitHub Pages) + WebRTC data channels** | Yes, free | **Start here.** Matches the brief's "P2P first". Direct phone-to-host connection when the networks allow it. |
| Small hosted relay (`wss://` WebSocket relay or TURN) | Yes | **Automatic fallback, built in M0.** Needed whenever a direct connection can't be made: phones on mobile data, guest Wi-Fi with client isolation, strict NAT. |
| Node server on host PC, self-signed cert | Scary browser warnings on every phone | Avoid. |
| Node server on host PC + tunnel (cloudflared etc.) | Yes | Viable "offline-ish" option later; adds setup for the host. |

So the "small Node server" from the brief is still built — but as a tiny **relay that can run anywhere with TLS**, not as a LAN-only server. Both transports sit behind one interface so games never know which is in use.

**How it looks to players:** the host opens the game's web address on the computer and gets the game browser and lobby. The lobby's QR code is that same address plus the room code. Phones scan it and land on the controller page. "Static hosting" only means the site is plain files with no server code of ours behind it.

**Same Wi-Fi is not required.** Internet is required (decided), and players may be on any network, including mobile data. Direct WebRTC often fails between different networks (mobile carriers especially), so each phone tries a direct connection first and silently falls back to the relay. Relayed input adds some delay; M0 measures whether tilt racing still feels good over the relay.

### 2.2 Architecture

- **Host-authoritative, star topology.** The host browser runs all game logic and rendering. Each phone connects only to the host. Phones send *inputs*; the host sends each phone a small *controller state* ("show the tilt pad + item button", "show this secret word", "show the vote list").
- **Phones are thin.** No game simulation on phones, so no prediction or reconciliation. The only thing that matters is input latency (target: under 80 ms phone → TV).
- **Two message channels:** *reliable/ordered* for state and submissions; *unreliable/unordered* for tilt streams (20–30 Hz, latest value wins).
- **Launcher + plug-in games.** The launcher owns lobby, players, connection, scoring across games, and the game picker. Each game is a module:

```ts
interface GameModule {
  meta: { id; name; minPlayers; maxPlayers; needsTilt; estMinutes; zone };
  attraction: { mapPosition; entranceModel; marquee };   // how it appears in the park
  createHost(ctx: HostContext): HostGame;          // TV side: logic + render
  createController(ctx: ControllerContext): ControllerGame; // phone side: UI
}
```

- **Controller kit** (shared phone widgets, built once, reused by all 14 games): tilt pad with calibration, big buttons, swipe/flick detector, rub detector, shake detector, drawing pad, text input with character limit, vote list, "secret card", waiting screen.
- **Round kit** (shared flow): intro card → countdown → play → results → scoreboard. Plus a reusable **prompt → submit → vote → reveal → score** pipeline, which powers six of the games.

### 2.3 Stack

TypeScript, Vite, **Three.js** on the host, plain DOM on the phone. Tilt Kart is built in Three.js from the start (top-down, low-poly) so it doesn't need rewriting when the 3D park arrives. Drawing and word games are flat panels (signs, posters, stage curtains) over a simple 3D backdrop of their attraction. PeerJS (or equivalent) for WebRTC signalling, a QR library, Vitest for game-logic tests. Monorepo layout:

```
/core         transport, rooms, players, module API, round kit
/controller   phone shell + controller kit
/host         launcher, lobby, game picker, scoreboards
/games/<id>   one folder per game (host + controller + content)
/relay        tiny Node WebSocket relay (fallback transport)
```

### 2.4 Things that must exist from day one

- **Reconnect.** Phones sleep, browsers get swiped away. A token in `localStorage` puts a player straight back in their seat mid-game.
- **Bots.** `?bots=11` fills the room with fake players that send plausible input. Without this, nothing designed for 12 can be tested by one person.
- **Touch fallback for tilt.** Some phones have no gyro or the player denied permission. Every tilt game also accepts an on-screen steering slider.
- **Screen wake lock** on phones during play.
- **VIP player.** First player to join controls menus from their phone, so nobody has to walk to the computer.
- **Late join = audience.** People who join mid-game can vote in voting games and wait for the next round otherwise.
- **Kick** for text and drawing games. No family filter for now (decided); a "family friendly" toggle in the lobby is a later addition, so prompt content is tagged from the start to make that cheap.

---

## 3. Theme: retro theme park

A 1950s carnival at dusk: faded paint, string lights, jingly organ music, a vintage mascot, fireworks. The whole pack is one evening at the park.

### 3.1 Look
- Stylized low-poly 3D in Three.js. Sun-bleached palette (cream, tomato red, teal, mustard) against a purple-orange dusk sky; string lights and marquee bulbs are the main light sources.
- First version of every model is built from simple shapes in code, so the park exists without waiting on an artist. Models can be replaced with hand-made ones later without touching game logic.
- The mascot is an original character who acts as the announcer: appears on signs, introduces each game, hands out prizes. Text and organ stings only, no voice acting.
- Audio direction is fairground organ / calliope. No audio is produced until samples are approved.

### 3.2 Joining: the ticket booth
- The TV opens on the park entrance with a giant ticket booth. The QR code and room code sit on the booth's marquee.
- The QR is drawn as a flat, high-contrast overlay facing the screen, never skewed on a 3D surface, so it scans from across the room. A small copy stays in a corner of the park map for late arrivals.
- On the phone: enter a name, pick an avatar, and receive a **ticket** (name + avatar + color/shape). The ticket is the phone's home screen for the night and later shows the prize-ticket count.
- On the TV: each new player's avatar walks through the turnstile with a clunk and joins the crowd.

### 3.3 Navigation: the park map
- Main menu is a tilted overhead view of the park. All player avatars wander as one crowd.
- The host (VIP) swipes on their phone to move between attractions; the crowd walks over and the attraction's marquee lights up with name, player count and length.
- Confirm, and the camera swoops down first-person to the ride entrance, then the game begins. The swoop is about 3 seconds and skippable, so replaying a game stays fast.
- Attractions that don't fit the current group size show a "CLOSED" sign. Games not yet built are fenced-off construction sites with "COMING SOON", so the map visibly grows as games are added. Each game registers its own spot on the map, so adding a game adds an attraction automatically.

### 3.4 Zones

| Zone | Attractions | In-park fiction |
|---|---|---|
| **Speedway** | Tilt Kart | Go-kart track |
| | Sky Slalom | Paper planes over the park through lit hoops, fireworks behind |
| | Snail Sprint | Derby booth with a mechanical snail-race board |
| **Lagoon** | Riptide Regatta | Boat race around the lagoon |
| **Art Alley** | Sketch & Switch | Caricature stalls |
| | Fake Artist | Shared easel on the street |
| | Draw Your Racer | Paint shop beside the track |
| | Logo Lab | Sign painter's workshop |
| **Midway** | Fib Finder | Barker's booth: "Step right up, spot the truth!" |
| | Punchline Duel | Puppet stage |
| | Hot Potato Bomb | Carnival game stall with a fizzing cartoon bomb |
| **Fortune Tent** | Secret Agent | Fortune teller; the location appears in the crystal ball |
| **Haunted Manor** | Heist Crew | The manor's vault |
| | Dungeon Vote | Ghost train: each vote is a track switch in the dark |

### 3.5 Prize tickets and the end of the night
- Every game pays out prize tickets by placement, scaled so each game is worth about the same regardless of length. Everyone earns something for playing.
- Phones show the running ticket count on the player's ticket; the park map shows a leaderboard on a painted scoreboard.
- The host can "close the park" at any time. Finale at the prize booth: players are called up from last to first, each receiving a prize sized to their rank (a comb, a goldfish, a kazoo…), and the winner gets the giant stuffed animal under fireworks.

## 4. Milestones

Build order follows the brief. Each milestone ends with a real-people playtest; the exit criteria are what must be true before moving on.

### M0 — Platform foundation
**Plain 2D menu** lobby with QR + room code (no 3D park yet), join flow, player identity (name, color, shape), transport abstraction with WebRTC and the relay fallback, reconnect, VIP menu control, game picker, module API, bots, iOS "Enable motion" flow, controller kit v0 (tilt, button).
Includes a throwaway **tech-test game**: every player is a dot they steer by tilt.
**Exit:** 8 real phones (mixed iOS/Android) join in under a minute, steer dots with no noticeable lag for 10 minutes, survive a phone lock/unlock, and at least one phone plays on mobile data instead of the host's Wi-Fi.

### M1 — Tilt Kart (builds the racing engine)
Racing engine: spline-based tracks, checkpoints/lap counting, kart physics, collisions, item system, catch-up logic, results. 3 tracks.
**Exit:** first-time players complete a lap without instruction; races with 12 are readable; last place still has fun.

### M2 — The park hub
Replaces the plain menu with the 3D park: entrance and ticket booth, phone tickets, turnstile walk-in, tilted park map with wandering crowd, swipe navigation, camera swoop into Tilt Kart, "closed" and "coming soon" states, prize tickets and scoreboard, end-of-night prize ceremony. All six zones are laid out; only the Speedway has a working ride.
**Exit:** runs smoothly on an ordinary laptop with integrated graphics; from scanning the QR to starting a race still takes under a minute; nobody is confused about how to pick a game.

### M3 — Riptide Regatta
Proves the racing engine is reusable: new physics profile (momentum, drift), currents/waves/whirlpools as track hazards, swipe-to-boost. 3 courses.
**Exit:** feels like a different game from Tilt Kart, built in well under half the time.

### M4 — Motion minis: Sky Slalom, Snail Sprint, Hot Potato Bomb
Adds swipe/flick, rub and shake to the controller kit. Three small games; each should take days, not weeks.

### M5 — Drawing: Sketch & Switch, Fake Artist, Logo Lab, then Draw Your Racer
Drawing pad (strokes sent as vectors, replayable on TV), the submit/vote/reveal pipeline, gallery reveal. Draw Your Racer comes last in this block because it needs both the drawing kit and the racing engine.

### M6 — Word / bluffing: Fib Finder, Punchline Duel, Secret Agent
Text input, content packs (prompts, trivia, locations), duplicate/truth detection, content tagged for a future family-friendly toggle.

### M7 — Co-op / strategy: Heist Crew, Dungeon Vote
Asymmetric per-phone information, puzzle generators, branching story content.

### M8 — Pack polish
Cross-game party scoring / playlists, sound and music pass (style chosen from audio samples first — no audio is produced for the game until samples are approved), family-friendly lobby toggle, consistent visual language, settings, accessibility pass, relay fallback hardened, final content pass.

**Rough sizing (one developer):** M0 2–3 weeks · M1 3–4 · M2 (park) 3–4 · M3 1–2 · M4 2–3 · M5 3–4 · M6 2–3 · M7 3–4 · M8 2–3. First playable party night is at the end of M1; the park arrives at the end of M2. Each later game also includes building its attraction entrance.

---

## 5. Game designs

### Racing / motion

**1. Tilt Kart** — 2–12 players, ~90 s races
- *TV:* whole track visible at once, top-down, no scrolling or split screen. Small karts with bold color + shape + trailing streak.
- *Phone:* held landscape like a steering wheel. Tilt steers, auto-accelerate, one big item button, shows your position and held item.
- *Items:* boost, oil slick, zap (slows the player ahead), shield. Better items for players further back.
- *Catch-up:* slight speed bonus toward the back, and short races in a best-of-3 cup so one bad race doesn't end your night.
- *Risk:* 12 karts on one screen turning into soup. Mitigate with wide tracks, soft kart-to-kart bumping, and a pulse on your kart when you tap your phone.

**2. Riptide Regatta** — 2–12 players, ~90 s
- Boats have momentum and drift; you steer early, not sharply. Currents push you, whirlpools pull and fling, waves give a speed burst if you hit them straight, buoys must be passed on the correct side.
- Swipe up to boost, on a cooldown shown on the phone.
- *Design goal:* Tilt Kart is twitchy; this is about reading the water and planning a line.

**3. Sky Slalom** — 2–12 players, ~75 s
- *View:* behind the planes, flying "into" the screen, rings approaching. This is the only view where both altitude and banking mean something and 12 planes stay readable.
- Tilt forward/back for altitude, left/right to bank. Paper planes glide: diving gains speed, climbing bleeds it.
- Score by rings threaded; gold centre for bonus; gusts push everyone sideways.

**4. Snail Sprint** — 2–12 players, ~45 s
- Rub the screen to crawl. Shake the phone and your snail gets sleepy (slows, then naps). The joke: frantic rubbing naturally shakes the phone, so the winner is whoever stays calm.
- Add "the gardener" who periodically looks up: any snail still moving gets sent back a little.
- Cheapest game in the pack; great palate cleanser between longer games.

**5. Hot Potato Bomb** — 3–12 players, ~30 s rounds, elimination
- The bomb is on one phone (screen goes red, vibrates). The TV shows a ring of players and where the bomb is. Hidden fuse.
- Flick to pass. Phones don't know where people are sitting, so the flick direction maps onto the TV ring: flick left/right to pass around the circle, flick up to throw across.
- *Greed mechanic:* you earn points for every second you hold it, so passing instantly is safe but worthless.
- Eliminated players get one "re-light" each: a tap that shortens the fuse.

### Drawing

**6. Sketch & Switch** — 4–12 players
- Everyone plays simultaneously: write a prompt → pass → draw it → pass → guess it → pass… Chains are **capped at 6 steps** regardless of player count, or the game drags.
- Reveal is the game: the TV steps through each chain, one link at a time, with the VIP advancing. Players award a "favorite" per chain for scoring.

**7. Fake Artist** — 4–10 players (cap below 12: turns are sequential)
- All but one see the word; the faker sees only the category. Each player adds one stroke in their color, two times around the circle (once around at 9+).
- Vote for the faker. If caught, the faker gets one guess at the word to steal the win.
- 20 s stroke timer; the TV shows whose turn it is in huge type.

**8. Draw Your Racer** — 2–12 players
- A pre-race mode rather than a standalone game: 60 s to draw your vehicle inside a template that shows which way is forward. Quick gallery parade, then it launches Tilt Kart or Riptide Regatta with the drawings as sprites.
- Bonus award voted by players: "best ride".

**9. Logo Lab** — 3–12 players
- Each player gets a made-up company ("Grandma's Tactical Yogurt"), draws a logo, then writes a slogan for *someone else's* logo. Vote for best logo and best slogan separately, so non-artists can still win.

### Word / bluffing

**10. Fib Finder** — 3–12 players
- Obscure trivia question with a blank. Everyone writes a plausible lie; lies and the truth are shuffled; everyone votes. Points for finding the truth and for each player you fool.
- Needs: detection when someone types the real answer (ask them to write a different lie), merging of duplicate lies, and a large question pack.

**11. Punchline Duel** — 3–12 players
- Each prompt goes to two players; everyone else votes. Each player answers two prompts per round. Final round: one prompt, everyone answers, everyone gets three votes.
- A unanimous win gets a bonus and a big screen effect.

**12. Secret Agent** — 4–10 players, 5–6 min
- Everyone's phone shows the location and a role, except the spy's, which shows the list of possible locations. The TV picks who asks whom, to keep it moving and avoid dead air.
- Any player can call a vote once per game; the spy can stop the clock to guess the location.
- With 9+ players, two spies who don't know each other.

### Co-op / strategy

**13. Heist Crew** — 2–6 per crew
- Each phone shows a different fragment: one sees the wires, one the manual, one the keypad, one the guard schedule. Nobody can solve anything alone; they have to describe what they see out loud. The TV shows the vault, timer and alarm level.
- A heist is 4–5 short puzzles with escalating time pressure. Puzzles are generated from templates so it's replayable.
- At 7–12 players: two crews race on a split TV. This is the cleanest way to keep everyone talking.

**14. Dungeon Vote** — 5–12 players, ~10 min
- The party walks a branching dungeon; each room is a vote (left/right, fight/flee, open/leave). The party has shared health. One traitor (two at 9+) sees which options are dangerous and wants the party dead before the exit.
- Votes are secret, but occasional "revealing" rooms expose how one random player voted. Mid-dungeon, the party can spend health to hold a trial and exile someone.
- Short text, strong consequences; rooms drawn from a pool so runs differ.

---

## 6. Player-count map

| Game | Min | Sweet spot | Max | At 11–12 players |
|---|---|---|---|---|
| Tilt Kart / Riptide Regatta | 2 | 6–8 | 12 | Works; widest tracks |
| Sky Slalom | 2 | 6–8 | 12 | Works |
| Snail Sprint | 2 | 8–12 | 12 | Best at max |
| Hot Potato Bomb | 3 | 6–10 | 12 | Works |
| Sketch & Switch | 4 | 6–8 | 12 | Chains capped at 6 |
| Fake Artist | 4 | 5–8 | 10 | Extra players join as audience voters |
| Draw Your Racer | 2 | 6–8 | 12 | Works |
| Logo Lab | 3 | 5–8 | 12 | Vote in two heats |
| Fib Finder | 3 | 5–8 | 12 | Show 8 lies max per question |
| Punchline Duel | 3 | 6–8 | 12 | Works (more duels) |
| Secret Agent | 4 | 6–8 | 10 | Two spies |
| Heist Crew | 2 | 4–5 | 12 | Two competing crews |
| Dungeon Vote | 5 | 7–10 | 12 | Two traitors |

The picker greys out games that don't fit the current room size.

---

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Direct WebRTC fails (players on different networks, mobile data, client isolation) | Some players can't join | Transport abstraction and relay fallback both in M0; auto-detect and switch |
| Relay adds input delay | Tilt racing feels sluggish for relayed players | Measure in M0; host relay close to players; show a connection-quality icon per player |
| iOS motion permission confuses players | Half the room can't steer | Full-screen "Enable motion" step in the join flow with a live tilt preview; touch fallback |
| Tilt feels laggy or twitchy | Racing games aren't fun | Calibrate neutral pose at countdown, deadzone + response curve, unreliable channel, measure latency in M0 |
| 12 players unreadable on TV | Racing chaos | Color + shape + name, bold outlines, "ping me" tap, wide tracks, test with bots from M1 |
| Phones sleep / tabs reload | Players drop mid-game | Wake lock, token-based reconnect, bot takes over in racing games until they return |
| Content volume (prompts, trivia, puzzles, rooms) | Games get stale by night two | Content as data files, target counts per game, treat writing as a scheduled task rather than an afterthought |
| 3D park is slow on the host's laptop | Stutter on the TV, laggy racing | Low-poly, few real lights, capped resolution, quality setting; tested on integrated graphics in M2 |
| The park becomes a time sink | Polish on the menu instead of games | M2 is time-boxed; simple-shape models first, prettier ones only in the polish milestone |
| Menu ceremony slows the party down | Breaks "playing in 30 seconds" | Swoop is short and skippable; "play again" skips the map entirely |
| 14 games is a lot | Never ships | Each milestone is a shippable pack on its own; shared kits make later games cheap |
| Offensive text/drawings | Awkward with the wrong crowd | VIP can kick or censor a submission; family-friendly lobby toggle later |

---

## 8. Playtesting

- **Every milestone:** one session with 6+ real people on their own phones. Watch for: time to first join, questions asked out loud, moments of laughter, moments people look at their phones when they should be looking up.
- **Each game must pass:** understood without explanation by round two · the room is noisy · someone asks to play again.
- **Kill rule:** a game that fails two playtests after iteration gets swapped for a backlog game.

---

## 9. Backlog (after the core 14)

Ranked by how much existing tech they reuse:

| Game | Reuses | Note |
|---|---|---|
| Downhill Derby | Racing engine | Gravity-driven third racing skin |
| Blind Contour | Drawing kit + vote | Draw without seeing your lines; nearly free |
| Tattoo Parlor | Drawing kit + vote | Logo Lab variant with "client" requests |
| Headline Hustle | Submit/vote pipeline | Fib Finder with fake headlines |
| Trivia Tower | Text/vote kit | Needs a question pack |
| Monster Mash-Up | Drawing kit | Three players draw head/body/legs |
| Auction House | Vote kit | Hidden-value bidding; new scoring logic |
| Rhythm Shake | Shake detector | Needs audio-sync work |
| Balance Tower | Tilt | Co-op tilt balancing; new physics |
| Fishing Frenzy | Tilt + flick | Cast and reel gestures |
| Sword Duel | Motion | 1v1 with spectators; hardest motion recognition |

---

## 10. Decisions

- **Internet:** required; no offline mode.
- **Networks:** players do not need to share the host's Wi-Fi.
- **Tone:** no family filter; a family-friendly lobby toggle may come later.
- **Audio:** samples must be heard and approved before any audio is generated for the game.
- **Theme:** retro 1950s theme park, low-poly 3D in Three.js; park map as the main menu; six zones; prize tickets and a stuffed-animal finale.
- **Build order:** plain menu + QR join + Tilt Kart first, then the park hub, then the remaining games.
- **Hosting:** static HTTPS site, pending confirmation.
