# Battleship — Black-Box Acceptance Test Plan

Scope: `http://localhost:8000/index.html` (served with `python3 -m http.server 8000` from the repo root).
Black-box: all interactions are driven through the UI. The console is used only to observe errors and, where noted, to read state for oracle purposes — never to drive the game.

## Rules under test (derived from README + agreed spec)

| # | Rule |
|---|---|
| R1 | 10x10 grid per side, labelled A–J across, 1–10 down |
| R2 | Fleet: Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2 (17 cells) |
| R3 | Ships are horizontal or vertical only; never diagonal |
| R4 | Ships may touch, but never overlap and never leave the board |
| R5 | Invalid placements are blocked and previewed in red |
| R6 | Battle cannot start until all 5 player ships are placed |
| R7 | Computer fleet is placed randomly and is hidden until sunk (or game over) |
| R8 | Turns strictly alternate: exactly one shot each, hit or miss; no extra turn on hit |
| R9 | A cell can be fired at only once per side |
| R10 | A ship sinks when all its cells are hit; sunk enemy ships are revealed |
| R11 | Game ends when one side's 17 cells are all hit; win/defeat screen shown |
| R12 | Restart / Play again fully resets boards, stats, log and phase |
| R13 | Stats: shots, hits, accuracy = hits/shots, ships sunk — per side |
| R14 | Sound toggle mutes all SFX and persists across reload |
| R15 | Miss = water/splash SFX + splash FX; hit = explosion SFX + blast FX; sinking animation |

## Test suites

### S1 — Happy path
- S1.1 Load page: both grids render 10x10 with correct labels; tray lists 5 ships with correct sizes; **Start battle** disabled. (R1, R2, R6)
- S1.2 Place all 5 ships by click-to-place; each sprite spans exactly its size in the chosen direction. (R2, R3)
- S1.3 Place by pointer drag from the tray; drop lands under the cursor. (R3)
- S1.4 Reposition an already-placed ship by dragging it. (R4)
- S1.5 Rotate via button, `R` key, and right-click; vertical ships render rotated and occupy the correct cells. (R3)
- S1.6 **Randomize** yields exactly 5 ships / 17 distinct occupied cells; **Clear** empties the board and re-disables Start. (R2, R6)
- S1.7 **Start battle**: setup panel hides, player fleet stays visible, enemy fleet hidden, enemy grid interactive. (R7)
- S1.8 Fire one shot: correct marker + FX + log line + stat update; AI replies once. (R8, R13, R15)

### S2 — Win / loss conditions
- S2.1 Sink every enemy ship: after the 17th enemy cell is hit, Victory overlay appears with final stats, all enemy ships revealed, banner reads a win. (R10, R11)
- S2.2 Lose deliberately (place fleet, then fire only into already-known empty water / stall while the AI hits): Defeat overlay appears, and the computer's "Ships sunk" counter increments as it sinks player ships. (R11, R13)
- S2.3 No further shots are accepted after the game ends (clicking enemy cells behind/after the overlay does nothing). (R11)
- S2.4 Accuracy math matches hits/shots at several checkpoints for both sides. (R13)

### S3 — Boundaries
- S3.1 Place each ship at all four corners and along each edge — valid placements must be accepted. (R4)
- S3.2 Attempt placements that overflow each edge (e.g. Carrier horizontal at G1..J1 anchor, Carrier vertical at row 7+): red preview, click rejected. (R5)
- S3.3 Attempt an overlapping placement: red preview, click rejected. (R4, R5)
- S3.4 Place two ships in adjacent (touching) cells: accepted. (R4)
- S3.5 Fire at the four corners and edge cells: resolves normally. (R1)
- S3.6 Rotation at a boundary that would overflow: rejected, ship stays in its previous valid position (no ship lost/duplicated). (R4, R5)

### S4 — Rapid input / race conditions
- S4.1 Double-click and triple-click the same enemy cell quickly: exactly one shot registers. (R9)
- S4.2 Click several different enemy cells in rapid succession (faster than the AI reply delay): only one player shot per AI shot; shot counts stay equal or differ by at most one. (R8)
- S4.3 Spam **Randomize** and **Rotate**: fleet always remains exactly 5 ships / 17 cells; no duplicate or lost ships.
- S4.4 Press **Restart** mid-AI-turn (immediately after firing): no stray AI shot lands on the fresh board; counters stay 0. (R12)
- S4.5 Hold `R` / hammer rotate during setup: no exception, no ship duplication.
- S4.6 Click **Play again** rapidly / double-click it: single clean reset. (R12)

### S5 — Restart behaviour
- S5.1 Restart during setup: partial fleet cleared. (R12)
- S5.2 Restart mid-battle: both boards, both stat blocks, the log and the phase banner reset; Start battle disabled again; enemy fleet re-randomized. (R12)
- S5.3 Play again from the overlay: same as S5.2 plus overlay dismissed. (R12)
- S5.4 Sound preference survives a restart (it is a user preference, not game state). (R14)

### S6 — Repeated playthroughs
- S6.1 Play three complete games back to back; each ends correctly with no state bleed (stale markers, stale sprites, log carry-over, phantom shots). (R11, R12)
- S6.2 Enemy layout differs between games (not a fixed seed). (R7)
- S6.3 Memory/DOM growth: FX nodes and ship sprites do not accumulate across games.

### S7 — Responsive layout
- S7.1 Desktop 1280x800 and 1024x768: both boards visible side by side, no overlap or clipping.
- S7.2 Tablet ~820x1100: layout reflows, grids square, labels aligned.
- S7.3 Mobile ~390x844: boards stack, all controls reachable, no horizontal scroll, cells large enough to tap.
- S7.4 Ship sprites stay aligned to their cells at every breakpoint (especially vertical ships, which are rendered rotated).
- S7.5 Overlay and stats panel readable at the narrowest breakpoint.

### S8 — Console / robustness
- S8.1 No errors or warnings in the console across a full playthrough, restart, and resize.
- S8.2 No 404s for assets (SVGs, MP3s).
- S8.3 Audio autoplay policy: first interaction does not throw an unhandled rejection.
- S8.4 Reload mid-battle: page comes back in a clean setup state (no persistence expected) with no errors.

## Failure reporting format

For each failure: exact repro steps, expected vs actual, evidence (screenshot / recording timestamp / console text), likely root cause, and a proposed regression test (headless in `tests/simulate.mjs` where the rule is engine-level, otherwise a scripted UI check).
