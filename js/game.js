import { Board } from './board.js';
import { HuntTargetAI } from './ai.js';
import { FLEET } from './constants.js';

export const PHASE = {
  SETUP: 'setup',
  PLAYER_TURN: 'player-turn',
  AI_TURN: 'ai-turn',
  OVER: 'over',
};

function emptyStats() {
  return { shots: 0, hits: 0, misses: 0, sunk: 0 };
}

export class Game {
  constructor() {
    this.reset();
  }

  reset() {
    this.phase = PHASE.SETUP;
    this.playerBoard = new Board();
    this.enemyBoard = new Board();
    this.ai = new HuntTargetAI();
    this.playerStats = emptyStats();
    this.enemyStats = emptyStats();
    this.winner = null;
  }

  startBattle() {
    if (!this.playerBoard.isComplete(FLEET)) return false;
    this.enemyBoard.placeRandomly(FLEET);
    this.phase = PHASE.PLAYER_TURN;
    return true;
  }

  canPlayerFire(row, col) {
    return this.phase === PHASE.PLAYER_TURN && !this.enemyBoard.alreadyShot(row, col);
  }

  playerFire(row, col) {
    if (!this.canPlayerFire(row, col)) return null;
    const outcome = this.enemyBoard.receiveShot(row, col);
    this.playerStats.shots += 1;
    this.playerStats[outcome.result === 'hit' ? 'hits' : 'misses'] += 1;
    if (outcome.sunk) this.playerStats.sunk += 1;

    if (this.enemyBoard.allSunk()) {
      this.phase = PHASE.OVER;
      this.winner = 'player';
    } else {
      this.phase = PHASE.AI_TURN;
    }
    return { ...outcome, row, col };
  }

  aiFire() {
    if (this.phase !== PHASE.AI_TURN) return null;
    const { row, col } = this.ai.nextShot();
    const outcome = this.playerBoard.receiveShot(row, col);
    this.ai.registerResult(row, col, outcome);
    this.enemyStats.shots += 1;
    this.enemyStats[outcome.result === 'hit' ? 'hits' : 'misses'] += 1;
    if (outcome.sunk) this.enemyStats.sunk += 1;

    if (this.playerBoard.allSunk()) {
      this.phase = PHASE.OVER;
      this.winner = 'enemy';
    } else {
      this.phase = PHASE.PLAYER_TURN;
    }
    return { ...outcome, row, col };
  }
}

export function accuracy(stats) {
  if (stats.shots === 0) return 0;
  return Math.round((stats.hits / stats.shots) * 100);
}
