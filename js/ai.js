import { BOARD_SIZE } from './constants.js';
import { inBounds } from './board.js';

const SMALLEST_SHIP = 2;

/**
 * Hunt/target AI: fires on a parity grid until it hits, then works
 * outward from the hit, locking onto an orientation once it finds one.
 */
export class HuntTargetAI {
  constructor() {
    this.reset();
  }

  reset() {
    this.tried = new Set();
    this.targets = [];
    this.currentHits = [];
  }

  static key(row, col) {
    return `${row},${col}`;
  }

  nextShot() {
    while (this.targets.length > 0) {
      const candidate = this.targets.shift();
      if (!this.tried.has(HuntTargetAI.key(candidate.row, candidate.col))) {
        return candidate;
      }
    }
    return this.randomHuntShot();
  }

  randomHuntShot() {
    const parityCells = [];
    const anyCells = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (this.tried.has(HuntTargetAI.key(row, col))) continue;
        anyCells.push({ row, col });
        if ((row + col) % SMALLEST_SHIP === 0) parityCells.push({ row, col });
      }
    }
    const pool = parityCells.length > 0 ? parityCells : anyCells;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** @param {{result: string, sunk: boolean}} outcome */
  registerResult(row, col, outcome) {
    this.tried.add(HuntTargetAI.key(row, col));
    if (outcome.result !== 'hit') return;

    if (outcome.sunk) {
      this.currentHits = [];
      this.targets = [];
      return;
    }

    this.currentHits.push({ row, col });
    this.targets = this.buildTargets();
  }

  buildTargets() {
    const hits = this.currentHits;
    const candidates = [];
    const push = (row, col) => {
      if (!inBounds(row, col)) return;
      if (this.tried.has(HuntTargetAI.key(row, col))) return;
      if (candidates.some((cell) => cell.row === row && cell.col === col)) return;
      candidates.push({ row, col });
    };

    if (hits.length >= 2) {
      const sameRow = hits.every((hit) => hit.row === hits[0].row);
      if (sameRow) {
        const row = hits[0].row;
        const cols = hits.map((hit) => hit.col);
        push(row, Math.min(...cols) - 1);
        push(row, Math.max(...cols) + 1);
      } else {
        const col = hits[0].col;
        const rows = hits.map((hit) => hit.row);
        push(Math.min(...rows) - 1, col);
        push(Math.max(...rows) + 1, col);
      }
      if (candidates.length > 0) return candidates;
    }

    hits.forEach(({ row, col }) => {
      push(row - 1, col);
      push(row + 1, col);
      push(row, col - 1);
      push(row, col + 1);
    });
    return candidates;
  }
}
