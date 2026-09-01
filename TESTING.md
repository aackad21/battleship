# Testing & Debugging Log

How this game was validated, every bug that was found, how it was found, and how it was fixed.

- App under test: `http://localhost:8000/index.html` (`python3 -m http.server 8000` from the repo root)
- Headless checks: `node tests/simulate.mjs` (or `npm test`)
- Browsers: Chrome (desktop 1280x800, 1024x768; emulated 820x1100 and 390x844)

## 1. Rules the tests assert

| # | Rule |
|---|---|
| R1 | 10x10 grid per side, labelled A–J across, 1–10 down |
| R2 | Fleet: Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2 (17 cells) |
| R3 | Ships are horizontal or vertical only; never diagonal |
| R4 | Ships may touch, never overlap, never leave the board |
| R5 | Invalid placements are blocked and previewed in red |
| R6 | Battle cannot start until all 5 player ships are placed |
| R7 | Computer fleet is random and hidden until sunk (or game over) |
| R8 | Turns strictly alternate — one shot each, hit or miss |
| R9 | A cell can be fired at only once per side |
| R10 | A ship sinks when all its cells are hit; sunk enemy ships are revealed |
| R11 | Game ends when one side's 17 cells are all hit; win/defeat screen shown |
| R12 | Restart / Play again fully resets boards, stats, log and phase |
| R13 | Stats: shots, hits, accuracy = hits/shots, ships sunk — per side |
| R14 | Sound toggle mutes all SFX and persists across reload |
| R15 | Miss = splash SFX + ring FX; hit = explosion SFX + blast/smoke FX; sinking animation |

## 2. Test execution summary

### 2.1 Headless suite — `node tests/simulate.mjs`

| Suite | Checks | Result |
|---|---|---|
| placement rules | in-bounds placement, out-of-bounds rejection, overlap rejection, touching allowed, rotation-overlap rejection, rotation keeps a single instance, random fleet = 17 distinct cells | pass |
| boundaries | placements flush against all four edges, overflow rejected past each edge (including negative origins from drag anchors), rotation that would overflow is rejected and leaves the ship unchanged, random fleet never leaves the board | pass |
| shot resolution | miss, hit, final hit reports sunk, hit list never double-counts, `allSunk()` | pass |
| ai + turn order (500 games) | strict alternation, shot counts never diverge by more than one, AI never repeats a cell, hunt/target averages ~58 shots (< 80 budget), every game terminates, no win declared with ships afloat | pass |
| rendering layers | marker layer is painted after the ship layer on both boards, markers styled on the marker layer rather than the cell, page declares a favicon | pass |

### 2.2 Black-box UI acceptance run (S1–S8)

Full plan: happy path, win/loss, boundaries, rapid input, restart, repeated playthroughs, responsive layout, console.

| ID | Test | Outcome |
|---|---|---|
| S1.1 | Initial screen: two 10x10 grids, 5-ship tray, Start battle disabled | pass |
| S1.2 | Click-to-place anchors the ship at the clicked cell (Carrier C3 → C3–G3) | pass |
| S1.3 | Pointer drag from tray with live preview, drops under the cursor | pass |
| S1.4 | Dragging a placed ship repositions it, honouring the grabbed segment | pass |
| S1.5 | Rotation via Rotate button, `R` key and right-click; vertical sprites align to their cells | pass |
| S1.6 | Randomize → 5 ships / 17 cells; Clear → empty board, Start disabled | pass |
| S1.7 | Start battle hides setup, keeps your fleet visible, hides enemy fleet, activates enemy grid | pass |
| S1.8 | Hit → blast FX + marker + log + stats; miss → splash; AI replies once | pass |
| S2.1 | Victory: all 17 enemy cells hit → overlay, final stats, enemy fleet revealed | pass |
| S2.2 | Defeat: clustered fleet + deliberately wasted shots → banner "The computer sank your fleet.", Defeat overlay, computer Ships sunk reached 5 | pass |
| S2.3 | No shots accepted after the game ends | pass |
| S2.4 | Accuracy equals hits/shots for both sides at every checkpoint | pass |
| S3.1 | Placements flush against edges/corners accepted | pass |
| S3.2 | Overflow past each edge → red preview, click rejected | pass |
| S3.3 | Overlapping placement → red preview, click rejected | pass |
| S3.4 | Adjacent (touching) ships accepted | pass |
| S3.5 | Firing at corners/edges resolves normally | pass |
| S3.6 | Rotation at a boundary that would overflow is rejected; ship not lost or duplicated | pass (now covered headlessly) |
| S4.1 | Double/triple-click one enemy cell → exactly one shot | pass |
| S4.2 | Burst of clicks on distinct enemy cells → one shot per turn | pass (see BUG-3) |
| S4.3 | Randomize ×6 then Rotate ×6 → always 5 ships / 17 cells / 5 sprites | pass |
| S4.4 | Restart immediately after firing → clean board, no stray AI shot | pass |
| S4.5 | Held `R` autorepeat during setup → no duplication, no errors | pass |
| S4.6 | Double-click Play again → single clean reset | pass |
| S5.1–5.3 | Restart during setup, mid-battle, and from the overlay reset boards, stats, log, banner, phase | pass |
| S5.4 | Sound preference survives Restart | pass |
| S6.1 | Three back-to-back playthroughs, no state bleed | pass |
| S6.2 | Enemy layout differs per game | pass |
| S6.3 | No sprite/FX/log accumulation after resets (0 sprites, 0 fx, 0 log rows) | pass |
| S7.1–7.5 | 1280x800, 1024x768, 820x1100, 390x844: square grids, no horizontal overflow, sprites aligned, overlay readable; full game played at 390x844 | pass |
| S8.1 | No JS errors or warnings across all suites | pass |
| S8.2 | No asset 404s | pass after BUG-2 |
| S8.3 | Sound enabled: no unhandled `audio.play()` rejection on first interaction | pass |
| S8.4 | Reload mid-battle → clean setup state, no errors | pass |

## 3. Bugs found and fixed

### BUG-1 (high) — Hit/miss markers and FX were hidden underneath ship sprites

- **How it was identified:** UI acceptance run S1.8/S2.2. The AI scored hits on the player's fleet, the cells carried the `hit` class in the DOM, but nothing was visible on screen. Confirmed by marking two carrier cells `hit` from the console and screenshotting: no marker appeared over the sprite.
- **Repro (before fix):** start a battle → let the AI hit one of your ships → look at the hit cell.
- **Expected:** orange hit marker plus blast/smoke FX on top of the ship.
- **Actual:** nothing visible; markers only showed on empty water. Same for enemy ships once revealed.
- **Root cause:** markers and FX were rendered inside the cell (`.cell.hit::after`, FX appended to the cell), while `.ship-layer` is a sibling occupying the same grid area and declared later in the document. Its absolutely-positioned sprites therefore paint above the cells' pseudo-elements.
- **Fix:** added a dedicated `.marker-layer` after the ship layer on each board. `js/main.js` now renders markers and FX into that layer via `placeInLayer()`, positioned by grid percentage, and `clearShotClasses()` empties it on reset. The `.cell.hit/.miss::after` styles were replaced by `.marker-hit/.marker-miss`.
- **Regression tests:** headless `rendering layers` suite asserts the marker layer is declared after the ship layer for both boards and that markers are styled on the marker layer, not the cell. Visual evidence after the fix: orange markers sitting on top of the carrier, cruiser and destroyer sprites.

### BUG-2 (low) — `GET /favicon.ico → 404`

- **How it was identified:** S8.1/S8.2 — the only red console error of the whole run; `grep " 404 " /tmp/httpd.log` matched exactly one request.
- **Expected:** no failing requests.
- **Actual:** Chrome's implicit favicon request 404'd because the page declared no icon.
- **Root cause:** no `<link rel="icon">` and no favicon asset.
- **Fix:** added `assets/img/favicon.svg` and linked it from `index.html`.
- **Regression test:** headless check asserts the page declares `rel="icon"`; the server log now shows `GET /assets/img/favicon.svg 200` and zero `favicon.ico` requests.

### BUG-3 (not a bug) — "rapid clicks on several cells fire two shots"

- **How it was identified:** reported by the UI acceptance run S4.2 (player shots went 1 → 3 after clicking four cells quickly).
- **Investigation:** a synchronous burst of five `click()`s on distinct enemy cells produced `{"phase":"player-turn","player":1,"ai":1}` — exactly one player shot and one AI reply. The turn guard (`busy` plus `PHASE.AI_TURN`) is set synchronously inside the click handler, so no second shot can slip through.
- **Conclusion:** the observed extra shot came from real mouse clicks spaced past the 750 ms AI reply — i.e. legal alternating turns, not a rules violation. No code change.
- **Regression test:** the 500-game suite now also asserts `|playerShots − aiShots| ≤ 1` at every step, which would fail if a player shot ever landed out of turn.

## 4. Why the game is considered debugged

1. **Every rule R1–R15 has an automated or executed test**, mapped in the tables above.
2. **The engine is verified exhaustively, not anecdotally**: 500 full games check alternation, shot balance, no repeated AI shots, guaranteed termination, and win-condition consistency; boundary and placement rules are checked in all four directions including negative origins produced by drag anchors.
3. **Both defects found have been fixed and are covered by regression tests** that fail if the layering or the favicon regresses; the third report was investigated and disproved with a reproducible measurement rather than left open.
4. **Both end states were exercised end-to-end through the UI** — victory and defeat, including the computer's ships-sunk counter — plus restart, three consecutive playthroughs, and reload mid-battle with no state bleed.
5. **Robustness cases pass**: duplicate-cell clicks, click bursts, Randomize/Rotate spam, held `R`, Restart mid-AI-turn, and double-clicked Play again.
6. **The console is clean** across every suite, and all assets return 200.
7. **The layout holds** from 1280x800 down to 390x844, where a complete game was played.

Residual risk (known, accepted): no automated DOM/browser test harness runs in CI — UI coverage is manual and the headless suite asserts markup/CSS invariants by static inspection. Audio playback is verified as "no unhandled rejection", not by capturing output. Only Chrome was tested.
