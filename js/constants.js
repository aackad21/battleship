export const BOARD_SIZE = 10;

export const FLEET = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'submarine', name: 'Submarine', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 },
];

export const TOTAL_SHIP_CELLS = FLEET.reduce((sum, ship) => sum + ship.size, 0);

export const HORIZONTAL = 'horizontal';
export const VERTICAL = 'vertical';

export const COLUMN_LABELS = 'ABCDEFGHIJ'.split('');
