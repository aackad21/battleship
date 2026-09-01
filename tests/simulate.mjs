/**
 * Headless rules + AI checks (no DOM needed): node tests/simulate.mjs
 */
import { Board } from '../js/board.js';
import { Game, PHASE } from '../js/game.js';
import { FLEET, HORIZONTAL, VERTICAL, TOTAL_SHIP_CELLS } from '../js/constants.js';

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
  check('ai never fires at the same cell twice', noRepeats);
  check(`hunt/target beats random search (avg ${avg.toFixed(1)} shots < 80)`, avg < 80);
  console.log(`  info player (random shots) won ${playerWins}/${games}`);
}

placementRules();
shotResolution();
fullGames();

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
