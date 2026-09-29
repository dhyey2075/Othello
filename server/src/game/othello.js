/**
 * Pure, dependency-free Othello (Reversi) engine.
 *
 * Board: 8x8 array of rows; each cell is 'black' | 'white' | null.
 * Every function is side-effect free: inputs are never mutated.
 */

export const SIZE = 8;
export const BLACK = 'black';
export const WHITE = 'white';

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export function opponentOf(color) {
  return color === BLACK ? WHITE : BLACK;
}

export function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

export function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

export function createInitialBoard() {
  const board = createEmptyBoard();
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

/**
 * Cells that would be flipped if `color` played at (row, col).
 * Returns [] when the move is illegal (occupied, off-board or flanks nothing).
 * Cells are ordered by direction, then by distance from the placed disc.
 */
export function getFlips(board, row, col, color) {
  if (!inBounds(row, col) || board[row][col] !== null) return [];
  const opponent = opponentOf(color);
  const flips = [];

  for (const [dr, dc] of DIRECTIONS) {
    const line = [];
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[r][c] === opponent) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    // A line only counts if it is closed off by one of our own discs.
    if (line.length > 0 && inBounds(r, c) && board[r][c] === color) {
      flips.push(...line);
    }
  }
  return flips;
}

export function isLegalMove(board, row, col, color) {
  return getFlips(board, row, col, color).length > 0;
}

export function getValidMoves(board, color) {
  const moves = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (isLegalMove(board, row, col, color)) moves.push({ row, col });
    }
  }
  return moves;
}

export function hasValidMove(board, color) {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (isLegalMove(board, row, col, color)) return true;
    }
  }
  return false;
}

/** Places a disc and flips; throws on an illegal move. */
export function applyMove(board, row, col, color) {
  const flipped = getFlips(board, row, col, color);
  if (flipped.length === 0) {
    throw new Error(`Illegal move for ${color} at (${row}, ${col})`);
  }
  const next = cloneBoard(board);
  next[row][col] = color;
  for (const cell of flipped) next[cell.row][cell.col] = color;
  return { board: next, flipped };
}

export function countDiscs(board) {
  let black = 0;
  let white = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === BLACK) black++;
      else if (cell === WHITE) white++;
    }
  }
  return { black, white, empty: SIZE * SIZE - black - white };
}

export function isBoardFull(board) {
  return countDiscs(board).empty === 0;
}

/** The game ends when neither side can move (a full board is a special case of this). */
export function isGameOver(board) {
  return isBoardFull(board) || (!hasValidMove(board, BLACK) && !hasValidMove(board, WHITE));
}

export function getWinner(board) {
  const { black, white } = countDiscs(board);
  if (black > white) return BLACK;
  if (white > black) return WHITE;
  return 'draw';
}

/* ------------------------------------------------------------------ */
/* Game state machine                                                   */
/* ------------------------------------------------------------------ */

export function createGame() {
  return {
    board: createInitialBoard(),
    turn: BLACK,
    status: 'playing', // 'playing' | 'finished'
    winner: null, // 'black' | 'white' | 'draw' | null
    lastMove: null, // { row, col, color }
    history: [], // [{ type: 'move', color, row, col, flipped } | { type: 'pass', color }]
    moveCount: 0,
  };
}

/**
 * Attempts a move. Never throws; returns either
 *   { ok: false, code, message }
 * or
 *   { ok: true, game, delta: { row, col, color, flipped, passed, gameOver, winner } }
 * where `passed` is the colour that had to pass after this move (or null).
 */
export function playMove(game, color, row, col) {
  if (game.status !== 'playing') {
    return { ok: false, code: 'GAME_NOT_ACTIVE', message: 'The game is not in progress.' };
  }
  if (color !== game.turn) {
    return { ok: false, code: 'NOT_YOUR_TURN', message: "It's not your turn." };
  }
  if (!Number.isInteger(row) || !Number.isInteger(col) || !inBounds(row, col)) {
    return { ok: false, code: 'ILLEGAL_MOVE', message: 'That cell is off the board.' };
  }
  if (game.board[row][col] !== null) {
    return { ok: false, code: 'ILLEGAL_MOVE', message: 'That cell is already taken.' };
  }
  const flips = getFlips(game.board, row, col, color);
  if (flips.length === 0) {
    return { ok: false, code: 'ILLEGAL_MOVE', message: 'A move must flank at least one opponent disc.' };
  }

  const { board, flipped } = applyMove(game.board, row, col, color);
  const history = [...game.history, { type: 'move', color, row, col, flipped: flipped.length }];
  const opponent = opponentOf(color);

  let turn = opponent;
  let passed = null;
  let status = 'playing';
  let winner = null;

  if (!hasValidMove(board, opponent)) {
    if (hasValidMove(board, color)) {
      // Opponent is stuck: they automatically pass and we move again.
      passed = opponent;
      turn = color;
      history.push({ type: 'pass', color: opponent });
    } else {
      status = 'finished';
      winner = getWinner(board);
    }
  }

  const next = {
    board,
    turn,
    status,
    winner,
    lastMove: { row, col, color },
    history,
    moveCount: game.moveCount + 1,
  };

  return {
    ok: true,
    game: next,
    delta: { row, col, color, flipped, passed, gameOver: status === 'finished', winner },
  };
}

/** Ends a game early (resignation, forfeit) in favour of `winner`. */
export function forfeitGame(game, winner) {
  return { ...game, status: 'finished', winner };
}
