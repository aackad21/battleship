import { BOARD_SIZE, FLEET, HORIZONTAL, VERTICAL } from './constants.js';

export function cellsFor(row, col, size, orientation) {
  const cells = [];
  for (let i = 0; i < size; i += 1) {
    cells.push(
      orientation === HORIZONTAL ? { row, col: col + i } : { row: row + i, col }
    );
  }
  return cells;
}

export function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export class Board {
  constructor() {
    this.ships = [];
    this.shots = new Map(); // key -> 'hit' | 'miss'
  }

  static key(row, col) {
    return `${row},${col}`;
  }

  shipAt(row, col) {
    return this.ships.find((ship) =>
      ship.cells.some((cell) => cell.row === row && cell.col === col)
    );
  }

  canPlace(row, col, size, orientation, ignoreShipId = null) {
    const cells = cellsFor(row, col, size, orientation);
    return cells.every((cell) => {
      if (!inBounds(cell.row, cell.col)) return false;
      const occupant = this.shipAt(cell.row, cell.col);
      return !occupant || occupant.id === ignoreShipId;
    });
  }

  place(shipDef, row, col, orientation) {
    if (!this.canPlace(row, col, shipDef.size, orientation, shipDef.id)) {
      return false;
    }
    this.remove(shipDef.id);
    this.ships.push({
      id: shipDef.id,
      name: shipDef.name,
      size: shipDef.size,
      row,
      col,
      orientation,
      cells: cellsFor(row, col, shipDef.size, orientation),
      hits: [],
    });
    return true;
  }

  remove(shipId) {
    this.ships = this.ships.filter((ship) => ship.id !== shipId);
  }

  clear() {
    this.ships = [];
    this.shots.clear();
  }

  placeRandomly(fleet = FLEET) {
    this.ships = [];
    fleet.forEach((shipDef) => {
      let placed = false;
      while (!placed) {
        const orientation = Math.random() < 0.5 ? HORIZONTAL : VERTICAL;
        const row = Math.floor(
          Math.random() * (orientation === VERTICAL ? BOARD_SIZE - shipDef.size + 1 : BOARD_SIZE)
        );
        const col = Math.floor(
          Math.random() * (orientation === HORIZONTAL ? BOARD_SIZE - shipDef.size + 1 : BOARD_SIZE)
        );
        placed = this.place(shipDef, row, col, orientation);
      }
    });
  }

  isComplete(fleet = FLEET) {
    return this.ships.length === fleet.length;
  }

  alreadyShot(row, col) {
    return this.shots.has(Board.key(row, col));
  }

  /**
   * @returns {{result: 'hit'|'miss', ship: object|null, sunk: boolean}}
   */
  receiveShot(row, col) {
    const key = Board.key(row, col);
    const ship = this.shipAt(row, col);
    if (!ship) {
      this.shots.set(key, 'miss');
      return { result: 'miss', ship: null, sunk: false };
    }
    this.shots.set(key, 'hit');
    if (!ship.hits.includes(key)) ship.hits.push(key);
    const sunk = ship.hits.length === ship.size;
    return { result: 'hit', ship, sunk };
  }

  isShipSunk(ship) {
    return ship.hits.length === ship.size;
  }

  allSunk() {
    return this.ships.length > 0 && this.ships.every((ship) => this.isShipSunk(ship));
  }

  remainingShips() {
    return this.ships.filter((ship) => !this.isShipSunk(ship));
  }
}
