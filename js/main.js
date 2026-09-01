import { BOARD_SIZE, COLUMN_LABELS, FLEET, HORIZONTAL, VERTICAL } from './constants.js';
import { cellsFor } from './board.js';
import { Game, PHASE, accuracy } from './game.js';
import { audio } from './audio.js';

const AI_DELAY_MS = 750;

const game = new Game();

const dom = {
  setupPanel: document.getElementById('setup-panel'),
  tray: document.getElementById('ship-tray'),
  rotateBtn: document.getElementById('rotate-btn'),
  randomBtn: document.getElementById('random-btn'),
  clearBtn: document.getElementById('clear-btn'),
  startBtn: document.getElementById('start-btn'),
  muteBtn: document.getElementById('mute-btn'),
  restartBtn: document.getElementById('restart-btn'),
  playerGrid: document.getElementById('player-grid'),
  enemyGrid: document.getElementById('enemy-grid'),
  playerShips: document.getElementById('player-ships'),
  enemyShips: document.getElementById('enemy-ships'),
  playerMarkers: document.getElementById('player-markers'),
  enemyMarkers: document.getElementById('enemy-markers'),
  playerWrap: document.getElementById('player-board-wrap'),
  enemyWrap: document.getElementById('enemy-board-wrap'),
  playerFleetStatus: document.getElementById('player-fleet-status'),
  enemyFleetStatus: document.getElementById('enemy-fleet-status'),
  turnBanner: document.getElementById('turn-banner'),
  log: document.getElementById('log'),
  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlay-title'),
  overlaySubtitle: document.getElementById('overlay-subtitle'),
  overlayStats: document.getElementById('overlay-stats'),
  playAgainBtn: document.getElementById('play-again-btn'),
};

const placement = {
  selectedShipId: FLEET[0].id,
  orientation: HORIZONTAL,
  anchorIndex: 0,
  carrying: false,
};

let busy = false;

/* ---------------- grid construction ---------------- */

function buildGrid(gridEl, side) {
  gridEl.innerHTML = '';
  gridEl.classList.add(side);
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute(
        'aria-label',
        `${side === 'enemy' ? 'Enemy' : 'Your'} cell ${COLUMN_LABELS[col]}${row + 1}`
      );
      gridEl.appendChild(cell);
    }
  }
}

function buildLabels(wrapEl) {
  const rowLabels = wrapEl.querySelector('.labels-row');
  const colLabels = wrapEl.querySelector('.labels-col');
  rowLabels.innerHTML = COLUMN_LABELS.map((label) => `<span>${label}</span>`).join('');
  colLabels.innerHTML = Array.from(
    { length: BOARD_SIZE },
    (_, index) => `<span>${index + 1}</span>`
  ).join('');
}

function cellAt(gridEl, row, col) {
  return gridEl.children[row * BOARD_SIZE + col];
}

/* ---------------- tray ---------------- */

function shipDef(shipId) {
  return FLEET.find((ship) => ship.id === shipId);
}

function renderTray() {
  dom.tray.innerHTML = '';
  FLEET.forEach((ship) => {
    const placed = Boolean(game.playerBoard.ships.find((entry) => entry.id === ship.id));
    const item = document.createElement('li');
    item.className = 'tray-item';
    item.dataset.shipId = ship.id;
    if (placed) item.classList.add('placed');
    if (placement.selectedShipId === ship.id) item.classList.add('selected');
    item.innerHTML = `
      <img src="assets/img/${ship.id}.svg" alt="" />
      <span class="tray-name">${ship.name}</span>
      <span class="tray-size">${ship.size}</span>
    `;
    dom.tray.appendChild(item);
  });
}

/* ---------------- ship sprites ---------------- */

function spriteFor(ship, { draggable = false, sunk = false } = {}) {
  const sprite = document.createElement('div');
  sprite.className = 'ship-sprite';
  sprite.dataset.shipId = ship.id;
  const lengthPct = ship.size * 10;
  if (ship.orientation === HORIZONTAL) {
    sprite.style.left = `${ship.col * 10}%`;
    sprite.style.top = `${ship.row * 10}%`;
    sprite.style.width = `${lengthPct}%`;
    sprite.style.height = '10%';
  } else {
    const centerX = (ship.col + 0.5) * 10;
    const centerY = (ship.row + ship.size / 2) * 10;
    sprite.style.left = `${centerX - lengthPct / 2}%`;
    sprite.style.top = `${centerY - 5}%`;
    sprite.style.width = `${lengthPct}%`;
    sprite.style.height = '10%';
    sprite.classList.add('vertical');
  }
  if (draggable) sprite.classList.add('draggable');
  if (sunk) sprite.classList.add('sunk');
  sprite.innerHTML = `<img src="assets/img/${ship.id}.svg" alt="${ship.name}" />`;
  return sprite;
}

function renderPlayerShips() {
  dom.playerShips.innerHTML = '';
  const setup = game.phase === PHASE.SETUP;
  game.playerBoard.ships.forEach((ship) => {
    const sunk = game.playerBoard.isShipSunk(ship);
    dom.playerShips.appendChild(spriteFor(ship, { draggable: setup, sunk }));
  });
}

function renderEnemyShips() {
  dom.enemyShips.innerHTML = '';
  const revealAll = game.phase === PHASE.OVER;
  game.enemyBoard.ships.forEach((ship) => {
    if (!revealAll && !game.enemyBoard.isShipSunk(ship)) return;
    dom.enemyShips.appendChild(
      spriteFor(ship, { sunk: game.enemyBoard.isShipSunk(ship) })
    );
  });
}

/* ---------------- shot rendering ---------------- */

function clearShotClasses(gridEl, markerLayerEl) {
  Array.from(gridEl.children).forEach((cell) => {
    cell.classList.remove('shot', 'hit', 'miss', 'sunk', 'preview-valid', 'preview-invalid');
  });
  markerLayerEl.innerHTML = '';
}

// markers and effects live above the ship layer so hits on a ship stay visible
function placeInLayer(layerEl, row, col, className) {
  const slot = document.createElement('span');
  slot.className = 'cell-slot';
  slot.style.left = `${col * 10}%`;
  slot.style.top = `${row * 10}%`;
  const node = document.createElement('span');
  node.className = className;
  slot.appendChild(node);
  layerEl.appendChild(slot);
  return node;
}

function addMarker(layerEl, row, col, kind) {
  placeInLayer(layerEl, row, col, `marker marker-${kind}`);
}

function playEffect(layerEl, row, col, kind) {
  const fx = placeInLayer(layerEl, row, col, `fx ${kind === 'hit' ? 'fx-blast' : 'fx-splash'}`);
  fx.addEventListener('animationend', () => fx.parentElement.remove());
  if (kind === 'hit') {
    const smoke = placeInLayer(layerEl, row, col, 'fx fx-smoke');
    smoke.addEventListener('animationend', () => smoke.parentElement.remove());
  }
}

function shakeBoard(wrapEl) {
  wrapEl.classList.remove('shake');
  // force reflow so the animation can retrigger
  void wrapEl.offsetWidth;
  wrapEl.classList.add('shake');
  wrapEl.addEventListener('animationend', () => wrapEl.classList.remove('shake'), {
    once: true,
  });
}

function animateSinking(layerEl, shipId) {
  const sprite = layerEl.querySelector(`.ship-sprite[data-ship-id="${shipId}"]`);
  if (sprite) sprite.classList.add('sinking');
}

/* ---------------- placement interactions ---------------- */

function clearPreview() {
  Array.from(dom.playerGrid.children).forEach((cell) =>
    cell.classList.remove('preview-valid', 'preview-invalid')
  );
}

function anchoredOrigin(row, col, orientation, anchorIndex) {
  return orientation === HORIZONTAL
    ? { row, col: col - anchorIndex }
    : { row: row - anchorIndex, col };
}

function showPreview(row, col) {
  clearPreview();
  const def = shipDef(placement.selectedShipId);
  if (!def || game.phase !== PHASE.SETUP) return;
  const origin = anchoredOrigin(row, col, placement.orientation, placement.anchorIndex);
  const valid = game.playerBoard.canPlace(
    origin.row,
    origin.col,
    def.size,
    placement.orientation,
    def.id
  );
  cellsFor(origin.row, origin.col, def.size, placement.orientation).forEach((cell) => {
    if (cell.row < 0 || cell.row >= BOARD_SIZE || cell.col < 0 || cell.col >= BOARD_SIZE) return;
    cellAt(dom.playerGrid, cell.row, cell.col).classList.add(
      valid ? 'preview-valid' : 'preview-invalid'
    );
  });
}

function tryPlace(row, col) {
  const def = shipDef(placement.selectedShipId);
  if (!def) return false;
  const origin = anchoredOrigin(row, col, placement.orientation, placement.anchorIndex);
  const placed = game.playerBoard.place(def, origin.row, origin.col, placement.orientation);
  if (!placed) return false;
  placement.anchorIndex = 0;
  selectNextUnplaced();
  refreshSetup();
  return true;
}

function selectNextUnplaced() {
  const next = FLEET.find(
    (ship) => !game.playerBoard.ships.some((entry) => entry.id === ship.id)
  );
  if (next) placement.selectedShipId = next.id;
}

function rotateSelected() {
  const def = shipDef(placement.selectedShipId);
  const placed = game.playerBoard.ships.find((ship) => ship.id === placement.selectedShipId);
  const nextOrientation = placement.orientation === HORIZONTAL ? VERTICAL : HORIZONTAL;

  if (placed && def) {
    const rotated = game.playerBoard.place(def, placed.row, placed.col, nextOrientation);
    if (!rotated) return;
  }
  placement.orientation = nextOrientation;
  refreshSetup();
}

function refreshSetup() {
  renderTray();
  renderPlayerShips();
  dom.startBtn.disabled = !game.playerBoard.isComplete(FLEET);
}

/* ---------------- game flow ---------------- */

function log(message, className = '') {
  const item = document.createElement('li');
  item.textContent = message;
  if (className) item.className = className;
  dom.log.prepend(item);
  while (dom.log.children.length > 30) dom.log.lastChild.remove();
}

function coordLabel(row, col) {
  return `${COLUMN_LABELS[col]}${row + 1}`;
}

function fleetStatusText(board) {
  return board.ships
    .map((ship) =>
      board.isShipSunk(ship)
        ? `<span class="down">${ship.name}</span>`
        : `<span>${ship.name}</span>`
    )
    .join(' · ');
}

function updateStats() {
  document.getElementById('player-shots').textContent = game.playerStats.shots;
  document.getElementById('player-hits').textContent = game.playerStats.hits;
  document.getElementById('player-accuracy').textContent = `${accuracy(game.playerStats)}%`;
  document.getElementById('player-sunk').textContent = game.playerStats.sunk;
  document.getElementById('enemy-shots').textContent = game.enemyStats.shots;
  document.getElementById('enemy-hits').textContent = game.enemyStats.hits;
  document.getElementById('enemy-accuracy').textContent = `${accuracy(game.enemyStats)}%`;
  document.getElementById('enemy-sunk').textContent = game.enemyStats.sunk;
  dom.playerFleetStatus.innerHTML = fleetStatusText(game.playerBoard);
  dom.enemyFleetStatus.innerHTML = game.enemyBoard.ships.length
    ? fleetStatusText(game.enemyBoard)
    : '';
}

function updateBanner() {
  if (game.phase === PHASE.SETUP) {
    dom.turnBanner.textContent = game.playerBoard.isComplete(FLEET)
      ? 'Fleet ready — start the battle.'
      : 'Place your ships to begin.';
  } else if (game.phase === PHASE.PLAYER_TURN) {
    dom.turnBanner.textContent = 'Your turn — fire at enemy waters.';
  } else if (game.phase === PHASE.AI_TURN) {
    dom.turnBanner.textContent = 'Enemy is taking aim…';
  } else {
    dom.turnBanner.textContent =
      game.winner === 'player' ? 'You win!' : 'The computer sank your fleet.';
  }
  dom.enemyGrid.classList.toggle('active', game.phase === PHASE.PLAYER_TURN);
}

function showOverlay() {
  const won = game.winner === 'player';
  dom.overlayTitle.textContent = won ? 'Victory' : 'Defeat';
  dom.overlaySubtitle.textContent = won
    ? 'Enemy fleet destroyed.'
    : 'Your fleet has been sunk.';
  dom.overlayStats.innerHTML = `
    <div><dt>Your shots</dt><dd>${game.playerStats.shots}</dd></div>
    <div><dt>Your accuracy</dt><dd>${accuracy(game.playerStats)}%</dd></div>
    <div><dt>Enemy shots</dt><dd>${game.enemyStats.shots}</dd></div>
    <div><dt>Enemy accuracy</dt><dd>${accuracy(game.enemyStats)}%</dd></div>
  `;
  dom.overlay.classList.remove('hidden');
}

function resolveOutcome(outcome, { gridEl, layerEl, markerEl, wrapEl, actor }) {
  const cell = cellAt(gridEl, outcome.row, outcome.col);
  cell.classList.add('shot', outcome.result);
  addMarker(markerEl, outcome.row, outcome.col, outcome.result);
  playEffect(markerEl, outcome.row, outcome.col, outcome.result);
  audio.play(outcome.sunk ? 'sunk' : outcome.result);
  if (outcome.result === 'hit') shakeBoard(wrapEl);

  const who = actor === 'player' ? 'You' : 'Computer';
  if (outcome.sunk) {
    outcome.ship.cells.forEach(({ row, col }) =>
      cellAt(gridEl, row, col).classList.add('sunk')
    );
    if (actor === 'player') renderEnemyShips();
    animateSinking(layerEl, outcome.ship.id);
    log(`${who} sank the ${outcome.ship.name}!`, 'sunk-line');
  } else {
    log(
      `${who} fired at ${coordLabel(outcome.row, outcome.col)} — ${outcome.result}.`,
      actor === 'player' ? 'you' : ''
    );
  }
  updateStats();
}

function finishGame() {
  renderEnemyShips();
  updateBanner();
  updateStats();
  if (game.winner === 'player') audio.play('victory');
  setTimeout(showOverlay, 700);
}

function handleEnemyCellClick(event) {
  const cell = event.target.closest('.cell');
  if (!cell || busy) return;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  if (!game.canPlayerFire(row, col)) return;

  busy = true;
  const outcome = game.playerFire(row, col);
  resolveOutcome(outcome, {
    gridEl: dom.enemyGrid,
    layerEl: dom.enemyShips,
    markerEl: dom.enemyMarkers,
    wrapEl: dom.enemyWrap,
    actor: 'player',
  });

  if (game.phase === PHASE.OVER) {
    busy = false;
    finishGame();
    return;
  }

  updateBanner();
  setTimeout(() => {
    const aiOutcome = game.aiFire();
    if (aiOutcome) {
      resolveOutcome(aiOutcome, {
        gridEl: dom.playerGrid,
        layerEl: dom.playerShips,
        markerEl: dom.playerMarkers,
        wrapEl: dom.playerWrap,
        actor: 'enemy',
      });
    }
    busy = false;
    if (game.phase === PHASE.OVER) finishGame();
    else updateBanner();
  }, AI_DELAY_MS);
}

/* ---------------- setup / reset ---------------- */

function startBattle() {
  if (!game.startBattle()) return;
  dom.setupPanel.classList.add('hidden');
  renderPlayerShips();
  renderEnemyShips();
  updateBanner();
  updateStats();
  log('Battle stations! Fire at will.');
}

function resetGame() {
  game.reset();
  placement.selectedShipId = FLEET[0].id;
  placement.orientation = HORIZONTAL;
  placement.anchorIndex = 0;
  busy = false;
  clearShotClasses(dom.playerGrid, dom.playerMarkers);
  clearShotClasses(dom.enemyGrid, dom.enemyMarkers);
  dom.enemyShips.innerHTML = '';
  dom.log.innerHTML = '';
  dom.overlay.classList.add('hidden');
  dom.setupPanel.classList.remove('hidden');
  refreshSetup();
  updateStats();
  updateBanner();
}

/* ---------------- event wiring ---------------- */

function wireTray() {
  dom.tray.addEventListener('click', (event) => {
    const item = event.target.closest('.tray-item');
    if (!item) return;
    placement.selectedShipId = item.dataset.shipId;
    placement.anchorIndex = 0;
    renderTray();
  });

  dom.tray.addEventListener('mousedown', (event) => {
    const item = event.target.closest('.tray-item');
    if (!item || event.button !== 0 || game.phase !== PHASE.SETUP) return;
    event.preventDefault();
    placement.selectedShipId = item.dataset.shipId;
    placement.anchorIndex = 0;
    placement.carrying = true;
    renderTray();
  });

  dom.tray.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    rotateSelected();
  });
}

function wirePlayerBoard() {
  dom.playerGrid.addEventListener('mousemove', (event) => {
    if (game.phase !== PHASE.SETUP) return;
    const cell = event.target.closest('.cell');
    if (!cell) return;
    showPreview(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  dom.playerGrid.addEventListener('mouseleave', clearPreview);

  dom.playerGrid.addEventListener('click', (event) => {
    if (game.phase !== PHASE.SETUP) return;
    const cell = event.target.closest('.cell');
    if (!cell) return;
    tryPlace(Number(cell.dataset.row), Number(cell.dataset.col));
    clearPreview();
  });

  dom.playerGrid.addEventListener('contextmenu', (event) => {
    if (game.phase !== PHASE.SETUP) return;
    event.preventDefault();
    rotateSelected();
    const cell = event.target.closest('.cell');
    if (cell) showPreview(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  // grabbing an already-placed ship to reposition it
  dom.playerShips.addEventListener('mousedown', (event) => {
    const sprite = event.target.closest('.ship-sprite');
    if (!sprite || event.button !== 0 || game.phase !== PHASE.SETUP) return;
    const ship = game.playerBoard.ships.find(
      (entry) => entry.id === sprite.dataset.shipId
    );
    if (!ship) return;
    event.preventDefault();
    placement.selectedShipId = ship.id;
    placement.orientation = ship.orientation;
    placement.anchorIndex = grabbedSegment(event, sprite, ship);
    placement.carrying = true;
    renderTray();
  });

  document.addEventListener('mouseup', (event) => {
    if (!placement.carrying) return;
    placement.carrying = false;
    const cell = event.target.closest?.('.cell');
    clearPreview();
    if (!cell || !dom.playerGrid.contains(cell)) return;
    tryPlace(Number(cell.dataset.row), Number(cell.dataset.col));
  });
}

function grabbedSegment(event, sprite, ship) {
  const rect = sprite.getBoundingClientRect();
  const along =
    ship.orientation === HORIZONTAL
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;
  return Math.min(ship.size - 1, Math.max(0, Math.floor(along * ship.size)));
}

function wireControls() {
  dom.rotateBtn.addEventListener('click', rotateSelected);

  dom.randomBtn.addEventListener('click', () => {
    game.playerBoard.placeRandomly(FLEET);
    refreshSetup();
    updateBanner();
  });

  dom.clearBtn.addEventListener('click', () => {
    game.playerBoard.clear();
    placement.selectedShipId = FLEET[0].id;
    refreshSetup();
    updateBanner();
  });

  dom.startBtn.addEventListener('click', startBattle);
  dom.restartBtn.addEventListener('click', resetGame);
  dom.playAgainBtn.addEventListener('click', resetGame);

  dom.muteBtn.addEventListener('click', () => {
    const muted = audio.toggleMute();
    dom.muteBtn.textContent = `Sound: ${muted ? 'Off' : 'On'}`;
    dom.muteBtn.setAttribute('aria-pressed', String(muted));
  });

  dom.enemyGrid.addEventListener('click', handleEnemyCellClick);

  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'r' && game.phase === PHASE.SETUP) {
      rotateSelected();
    }
  });
}

function init() {
  buildGrid(dom.playerGrid, 'player');
  buildGrid(dom.enemyGrid, 'enemy');
  buildLabels(dom.playerWrap);
  buildLabels(dom.enemyWrap);
  wireTray();
  wirePlayerBoard();
  wireControls();
  dom.muteBtn.textContent = `Sound: ${audio.isMuted ? 'Off' : 'On'}`;
  dom.muteBtn.setAttribute('aria-pressed', String(audio.isMuted));
  refreshSetup();
  updateStats();
  updateBanner();
}

init();

// exposed for debugging in the console
window.battleship = { game };
