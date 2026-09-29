import { describe, expect, it } from 'vitest';
import {
  BLACK,
  WHITE,
  applyMove,
  countDiscs,
  createEmptyBoard,
  createGame,
  createInitialBoard,
  getFlips,
  getValidMoves,
  getWinner,
  hasValidMove,
  isGameOver,
  playMove,
} from '../src/game/othello.js';

const sortCells = (cells) =>
  [...cells].sort((a, b) => a.row - b.row || a.col - b.col).map(({ row, col }) => [row, col]);

/** Builds a board from 8 strings using B / W / . */
function boardFrom(rows) {
  return rows.map((line) => line.split('').map((ch) => (ch === 'B' ? BLACK : ch === 'W' ? WHITE : null)));
}

describe('initial board', () => {
  it('has the standard four-disc start position', () => {
    const board = createInitialBoard();
    expect(board[3][3]).toBe(WHITE);
    expect(board[3][4]).toBe(BLACK);
    expect(board[4][3]).toBe(BLACK);
    expect(board[4][4]).toBe(WHITE);
    expect(countDiscs(board)).toEqual({ black: 2, white: 2, empty: 60 });
  });

  it('starts with black to move', () => {
    const game = createGame();
    expect(game.turn).toBe(BLACK);
    expect(game.status).toBe('playing');
  });
});

describe('legal moves', () => {
  it('gives black exactly four opening moves', () => {
    const moves = getValidMoves(createInitialBoard(), BLACK);
    expect(sortCells(moves)).toEqual([[2, 3], [3, 2], [4, 5], [5, 4]]);
  });

  it('gives white the mirrored four opening moves', () => {
    const moves = getValidMoves(createInitialBoard(), WHITE);
    expect(sortCells(moves)).toEqual([[2, 4], [3, 5], [4, 2], [5, 3]]);
  });

  it('rejects occupied cells, off-board cells and moves that flank nothing', () => {
    const board = createInitialBoard();
    expect(getFlips(board, 3, 3, BLACK)).toEqual([]);
    expect(getFlips(board, -1, 0, BLACK)).toEqual([]);
    expect(getFlips(board, 8, 8, BLACK)).toEqual([]);
    expect(getFlips(board, 0, 0, BLACK)).toEqual([]);
    expect(getFlips(board, 2, 2, BLACK)).toEqual([]); // diagonal to own-colour disc only
  });

  it('does not count a line that runs off the board without closing', () => {
    const board = boardFrom([
      '.WWWWWWW',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]);
    expect(getFlips(board, 0, 0, BLACK)).toEqual([]);
  });
});

describe('flipping', () => {
  it('flips a single line', () => {
    const { board, flipped } = applyMove(createInitialBoard(), 2, 3, BLACK);
    expect(sortCells(flipped)).toEqual([[3, 3]]);
    expect(board[2][3]).toBe(BLACK);
    expect(board[3][3]).toBe(BLACK);
    expect(countDiscs(board)).toEqual({ black: 4, white: 1, empty: 59 });
  });

  it('flips in multiple directions at once and leaves unflanked lines alone', () => {
    const board = boardFrom([
      '........',
      '........',
      '....B...',
      '....W...',
      '...W.WB.',
      '...W.W..',
      '..B...W.',
      '.......B',
    ]);
    // Black at (4,4): up (3,4), right (4,5), down-left (5,3) and down-right (5,5),(6,6).
    // Left (4,3) runs into an empty cell, so it must NOT flip.
    const flips = getFlips(board, 4, 4, BLACK);
    expect(sortCells(flips)).toEqual([[3, 4], [4, 5], [5, 3], [5, 5], [6, 6]]);

    const { board: after } = applyMove(board, 4, 4, BLACK);
    for (const [r, c] of [[3, 4], [4, 5], [5, 3], [5, 5], [6, 6]]) expect(after[r][c]).toBe(BLACK);
    expect(after[4][3]).toBe(WHITE);
  });

  it('does not mutate the input board', () => {
    const board = createInitialBoard();
    const copy = JSON.stringify(board);
    applyMove(board, 2, 3, BLACK);
    expect(JSON.stringify(board)).toBe(copy);
  });

  it('throws on an illegal applyMove', () => {
    expect(() => applyMove(createInitialBoard(), 0, 0, BLACK)).toThrow();
  });
});

describe('playMove state machine', () => {
  it('alternates turns and records history', () => {
    const r = playMove(createGame(), BLACK, 2, 3);
    expect(r.ok).toBe(true);
    expect(r.game.turn).toBe(WHITE);
    expect(r.game.lastMove).toEqual({ row: 2, col: 3, color: BLACK });
    expect(r.game.history).toEqual([{ type: 'move', color: BLACK, row: 2, col: 3, flipped: 1 }]);
    expect(r.delta.passed).toBeNull();
  });

  it('rejects out-of-turn and illegal moves', () => {
    const game = createGame();
    expect(playMove(game, WHITE, 2, 4)).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' });
    expect(playMove(game, BLACK, 0, 0)).toMatchObject({ ok: false, code: 'ILLEGAL_MOVE' });
    expect(playMove(game, BLACK, 3, 3)).toMatchObject({ ok: false, code: 'ILLEGAL_MOVE' });
    expect(playMove(game, BLACK, 9, 1)).toMatchObject({ ok: false, code: 'ILLEGAL_MOVE' });
  });

  it('passes automatically when the opponent has no legal move', () => {
    const board = boardFrom([
      '.WB.....',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      'BW......',
    ]);
    const game = { ...createGame(), board };
    const r = playMove(game, BLACK, 0, 0);
    expect(r.ok).toBe(true);
    expect(hasValidMove(r.game.board, WHITE)).toBe(false);
    expect(r.delta.passed).toBe(WHITE);
    expect(r.game.turn).toBe(BLACK);
    expect(r.game.status).toBe('playing');
    expect(r.game.history.at(-1)).toEqual({ type: 'pass', color: WHITE });
  });

  it('ends the game when neither player can move', () => {
    const board = boardFrom([
      '.WB.....',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]);
    const r = playMove({ ...createGame(), board }, BLACK, 0, 0);
    expect(r.ok).toBe(true);
    expect(r.delta.gameOver).toBe(true);
    expect(r.game.status).toBe('finished');
    expect(r.game.winner).toBe(BLACK);
    expect(playMove(r.game, WHITE, 5, 5)).toMatchObject({ ok: false, code: 'GAME_NOT_ACTIVE' });
  });

  it('ends the game when the board fills up', () => {
    const rows = Array.from({ length: 8 }, () => 'BBBBBBBB');
    rows[0] = '.WBBBBBB';
    const r = playMove({ ...createGame(), board: boardFrom(rows) }, BLACK, 0, 0);
    expect(r.ok).toBe(true);
    expect(countDiscs(r.game.board).empty).toBe(0);
    expect(r.game.status).toBe('finished');
    expect(r.game.winner).toBe(BLACK);
  });
});

describe('game over and winner', () => {
  it('detects a full board as game over', () => {
    const board = boardFrom(Array.from({ length: 8 }, () => 'BBBBWWWW'));
    expect(isGameOver(board)).toBe(true);
  });

  it('detects game over with empty cells when nobody can move', () => {
    const board = createEmptyBoard();
    board[0][0] = BLACK;
    board[7][7] = BLACK;
    expect(isGameOver(board)).toBe(true);
    expect(getWinner(board)).toBe(BLACK);
  });

  it('is not over at the start', () => {
    expect(isGameOver(createInitialBoard())).toBe(false);
  });

  it('picks the colour with more discs', () => {
    const board = boardFrom(Array.from({ length: 8 }, (_, i) => (i < 5 ? 'WWWWWWWW' : 'BBBBBBBB')));
    expect(getWinner(board)).toBe(WHITE);
  });

  it('reports a draw on equal counts', () => {
    const board = boardFrom(Array.from({ length: 8 }, () => 'BBBBWWWW'));
    expect(getWinner(board)).toBe('draw');
  });
});
