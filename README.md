# Battleship

A dependency-free browser Battleship game: you versus a hunt/target AI on classic
10x10 grids, with top-down ship art, splash/explosion effects, and sound.

## Play

No build step and no dependencies — open `index.html` in a browser, or serve the
folder to avoid `file://` module restrictions:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How it plays

- **Deploy** — drag a ship from the tray onto your grid, or select it and click a
  cell. Press <kbd>R</kbd>, right-click, or hit **Rotate** to flip orientation.
  **Randomize** places the whole fleet for you; invalid placements are blocked and
  highlighted red.
- **Battle** — click a cell in enemy waters to fire. Turns strictly alternate: one
  shot each, hit or miss. Sunk enemy ships are revealed on the board.
- **Fleet** — Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2).
  Ships may touch; diagonal placement is not allowed.
- **AI** — fires on a parity pattern while hunting, then targets around a hit and
  locks onto the ship's orientation once two hits line up.

## Layout

```
index.html          markup and layout
css/styles.css      styling, animations
js/constants.js     board size, fleet definition
js/board.js         grid state, placement rules, shot resolution
js/ai.js            hunt/target AI
js/game.js          phases, turn order, stats
js/audio.js         sound pooling and mute persistence
js/main.js          DOM wiring, rendering, effects
tools/generate_ships.py   regenerates the ship SVGs in assets/img
tests/simulate.mjs  headless rules + AI checks
```

## Checks

```bash
node tests/simulate.mjs   # or: npm test
```

Covers placement rules, boundaries, shot/sunk resolution, strict turn alternation,
rendering-layer invariants, and runs 500 simulated games to confirm the AI never
repeats a shot and beats random search.

[TESTING.md](TESTING.md) documents the full test matrix, the bugs found and their
fixes; [docs/acceptance-test-plan.md](docs/acceptance-test-plan.md) is the black-box
plan those runs follow.

## Credits

Sound effects are CC0 (public domain) from OpenGameArt — see [CREDITS.md](CREDITS.md).
