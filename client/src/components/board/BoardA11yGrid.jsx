import { useRef } from 'react';

const COLS = 'ABCDEFGH';
export const cellName = (row, col) => `${COLS[col]}${row + 1}`;

/**
 * Visually hidden but focusable grid of 64 buttons mirroring the 3D board.
 * Screen readers get a full description; keyboard users move with the arrow
 * keys (roving tabindex) and play with Enter/Space while the 3D scene draws a
 * focus square on the active cell.
 */
export function BoardA11yGrid({ board, validMoves, canPlay, focused, onFocusCell, onPlay }) {
  const refs = useRef([]);
  const valid = new Set(validMoves.map((m) => `${m.row}-${m.col}`));
  const active = focused ?? validMoves[0] ?? { row: 3, col: 3 };

  const move = (row, col) => {
    const r = (row + 8) % 8;
    const c = (col + 8) % 8;
    refs.current[r * 8 + c]?.focus();
  };

  const onKeyDown = (e, row, col) => {
    const keys = {
      ArrowUp: [row - 1, col],
      ArrowDown: [row + 1, col],
      ArrowLeft: [row, col - 1],
      ArrowRight: [row, col + 1],
      Home: [row, 0],
      End: [row, 7],
    };
    if (keys[e.key]) {
      e.preventDefault();
      move(...keys[e.key]);
    }
  };

  return (
    <div role="grid" aria-label="Othello board, 8 by 8. Use arrow keys to move and Enter to place a disc." className="sr-only">
      {Array.from({ length: 8 }, (_, row) => (
        <div role="row" key={row}>
          {Array.from({ length: 8 }, (_, col) => {
            const color = board?.[row]?.[col];
            const legal = canPlay && valid.has(`${row}-${col}`);
            const label = `${cellName(row, col)}, ${color ? `${color} disc` : 'empty'}${legal ? ', legal move' : ''}`;
            return (
              <button
                key={col}
                type="button"
                role="gridcell"
                ref={(el) => (refs.current[row * 8 + col] = el)}
                tabIndex={active.row === row && active.col === col ? 0 : -1}
                aria-label={label}
                aria-disabled={!legal}
                onFocus={() => onFocusCell({ row, col })}
                onBlur={() => onFocusCell(null)}
                onKeyDown={(e) => onKeyDown(e, row, col)}
                onClick={() => onPlay(row, col)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
