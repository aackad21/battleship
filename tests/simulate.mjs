/**
 * Headless rules + AI checks (no DOM needed): node tests/simulate.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Board } from '../js/board.js';
import { Game, PHASE } from '../js/game.js';
import { BOARD_SIZE, FLEET, HORIZONTAL, VERTICAL, TOTAL_SHIP_CELLS } from '../js/constants.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const readRepoFile = (relative) => readFileSync(repoRoot + relative, 'utf8');

let failures = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`);
  }
}

function placementRules() {
  console.log('placement rules');
  const board = new Board();
  const carrier = FLEET[0];
  const destroyer = FLEET[4];

  check('places a ship in bounds', board.place(carrier, 0, 0, HORIZONTAL));
  check('rejects out-of-bounds placement', !board.canPlace(0, 7, carrier.size, HORIZONTAL));
  check('rejects overlapping placement', !board.canPlace(0, 3, destroyer.size, HORIZONTAL));
  check('allows ships to touch', board.place(destroyer, 1, 0, HORIZONTAL));
  check('rejects a rotation that would overlap', !board.place(carrier, 0, 0, VERTICAL));
  check(
    'rotating in place keeps a single instance',
    board.place(carrier, 0, 5, HORIZONTAL) &&
      board.place(carrier, 0, 5, VERTICAL) &&
      board.ships.filter((ship) => ship.id === carrier.id).length === 1
  );

  board.placeRandomly(FLEET);
  const occupied = new Set();
  board.ships.forEach((ship) =>
    ship.cells.forEach((cell) => occupied.add(`${cell.row},${cell.col}`))
  );
  check('random fleet occupies exactly 17 distinct cells', occupied.size === TOTAL_SHIP_CELLS);
}

function boundaryRules() {
  console.log('boundaries');
  const carrier = FLEET[0];
  const last = BOARD_SIZE - 1;

  const corners = new Board();
  check(
    'accepts placements flush against every edge',
    corners.canPlace(0, 0, carrier.size, HORIZONTAL) &&
      corners.canPlace(0, BOARD_SIZE - carrier.size, carrier.size, HORIZONTAL) &&
      corners.canPlace(last, 0, carrier.size, HORIZONTAL) &&
      corners.canPlace(0, last, carrier.size, VERTICAL) &&
      corners.canPlace(BOARD_SIZE - carrier.size, last, carrier.size, VERTICAL)
  );
  check(
    'rejects overflow past each of the four edges',
    !corners.canPlace(0, BOARD_SIZE - carrier.size + 1, carrier.size, HORIZONTAL) &&
      !corners.canPlace(BOARD_SIZE - carrier.size + 1, 0, carrier.size, VERTICAL) &&
      !corners.canPlace(0, -1, carrier.size, HORIZONTAL) &&
      !corners.canPlace(-1, 0, carrier.size, VERTICAL)
  );

  // rotating at an edge where the ship would overflow must leave it untouched
  const edge = new Board();
  edge.place(carrier, last, 0, HORIZONTAL);
  const before = JSON.stringify(edge.ships);
  check('rejects a rotation that would overflow the board', !edge.place(carrier, last, 0, VERTICAL));
  check('ship survives a rejected rotation unchanged', JSON.stringify(edge.ships) === before);

  const board = new Board();
  board.placeRandomly(FLEET);
  check(
    'random fleet never leaves the board',
    board.ships.every((ship) =>
      ship.cells.every(
        (cell) =>
          cell.row >= 0 && cell.row < BOARD_SIZE && cell.col >= 0 && cell.col < BOARD_SIZE
      )
    )
  );
}

function shotResolution() {
  console.log('shot resolution');
  const board = new Board();
  const destroyer = FLEET[4];
  board.place(destroyer, 4, 4, HORIZONTAL);

  check('miss on empty water', board.receiveShot(0, 0).result === 'miss');
  const first = board.receiveShot(4, 4);
  check('hit on ship', first.result === 'hit' && !first.sunk);
  const second = board.receiveShot(4, 5);
  check('final hit reports sunk', second.result === 'hit' && second.sunk);
  check('sunk ship counts once', board.ships[0].hits.length === destroyer.size);
  check('repeat shot does not double-count hits', (() => {
    board.receiveShot(4, 5);
    return board.ships[0].hits.length === destroyer.size;
  })());
  check('allSunk true when fleet destroyed', board.allSunk());
}

function fullGames(games = 500) {
  console.log(`ai + turn order over ${games} games`);
  let playerWins = 0;
  let aiShots = 0;
  let alternated = true;
  let noRepeats = true;
  let balanced = true;

  for (let i = 0; i < games; i += 1) {
    const game = new Game();
    game.playerBoard.placeRandomly(FLEET);
    game.startBattle();
    const aiSeen = new Set();
    let guard = 0;

    while (game.phase !== PHASE.OVER && guard < 400) {
      guard += 1;
      const open = [];
      for (let row = 0; row < 10; row += 1) {
        for (let col = 0; col < 10; col += 1) {
          if (!game.enemyBoard.alreadyShot(row, col)) open.push([row, col]);
        }
      }
      const [row, col] = open[Math.floor(Math.random() * open.length)];
      if (game.playerFire(row, col) === null) alternated = false;
      if (game.phase === PHASE.AI_TURN) {
        const outcome = game.aiFire();
        if (outcome === null) alternated = false;
        const key = `${outcome.row},${outcome.col}`;
        if (aiSeen.has(key)) noRepeats = false;
        aiSeen.add(key);
      }
      if (Math.abs(game.playerStats.shots - game.enemyStats.shots) > 1) balanced = false;
    }

    if (guard >= 400) {
      failures += 1;
      console.log('  FAIL game failed to terminate');
      return;
    }
    if (game.winner === 'player') playerWins += 1;
    else if (!game.playerBoard.allSunk()) {
      failures += 1;
      console.log('  FAIL declared an enemy win with ships afloat');
    }
    aiShots += game.enemyStats.shots;
  }

  const avg = aiShots / games;
  check('turns strictly alternate', alternated);
  check('shot counts never diverge by more than one', balanced);
  check('ai never fires at the same cell twice', noRepeats);
  check(`hunt/target beats random search (avg ${avg.toFixed(1)} shots < 80)`, avg < 80);
  console.log(`  info player (random shots) won ${playerWins}/${games}`);
}

function renderingLayers() {
  console.log('rendering layers');
  const html = readRepoFile('index.html');
  const css = readRepoFile('css/styles.css');
  const boardMarkup = html.slice(html.indexOf('<section class="boards">'));

  ['player', 'enemy'].forEach((side) => {
    const shipAt = boardMarkup.indexOf(`id="${side}-ships"`);
    const markerAt = boardMarkup.indexOf(`id="${side}-markers"`);
    check(
      `${side} markers paint above the ship layer`,
      shipAt !== -1 && markerAt !== -1 && markerAt > shipAt
    );
  });

  check('shot markers are styled on the marker layer, not the cell', css.includes('.marker-hit::after') && !css.includes('.cell.hit::after'));
  check('page declares a favicon', html.includes('rel="icon"'));
}

placementRules();
boundaryRules();
shotResolution();
fullGames();
renderingLayers();

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
