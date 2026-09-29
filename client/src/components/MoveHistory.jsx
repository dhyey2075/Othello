import { useEffect, useRef } from 'react';
import { cellName } from './board/BoardA11yGrid.jsx';
import { DiscIcon } from './ui/DiscIcon.jsx';
import { HistoryIcon } from './ui/icons.jsx';

export function MoveHistory({ history, players }) {
  const listRef = useRef(null);
  const nameOf = (color) => players.find((p) => p.color === color)?.name ?? color;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  let moveNo = 0;
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-ink-900/60 p-4" aria-label="Move history">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
        <HistoryIcon width={14} height={14} /> Moves
        <span className="ml-auto font-mono text-ink-500">{history.filter((h) => h.type === 'move').length}</span>
      </h2>
      {history.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-500">No moves yet — Black opens.</p>
      ) : (
        <ol ref={listRef} className="max-h-56 space-y-1 overflow-y-auto pr-1 text-sm lg:max-h-[min(40vh,22rem)]">
          {history.map((h, i) => {
            if (h.type === 'pass') {
              return (
                <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs italic text-ink-400">
                  <DiscIcon color={h.color} size={10} /> {nameOf(h.color)} passed
                </li>
              );
            }
            moveNo += 1;
            return (
              <li
                key={i}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1 ${i === history.length - 1 ? 'bg-white/[0.05]' : ''}`}
              >
                <span className="w-6 text-right font-mono text-xs text-ink-500">{moveNo}.</span>
                <DiscIcon color={h.color} size={12} />
                <span className="font-mono font-semibold text-ink-100">{cellName(h.row, h.col)}</span>
                <span className="ml-auto text-xs text-ink-400">
                  +{h.flipped} flip{h.flipped === 1 ? '' : 's'}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
