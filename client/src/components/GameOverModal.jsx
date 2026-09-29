import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './ui/Button.jsx';
import { DiscIcon } from './ui/DiscIcon.jsx';
import { TrophyIcon } from './ui/icons.jsx';

const WIN_REASONS = {
  opponent_left: 'Your opponent left the game.',
  opponent_timeout: "Your opponent didn't reconnect in time.",
};
const LOSS_REASONS = {
  opponent_left: 'You left the game.',
  opponent_timeout: "You didn't reconnect in time.",
};

export function GameOverModal({ open, state, me, opponent, onRematch, onHome, onClose }) {
  const primaryRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => primaryRef.current?.focus(), 50);
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!state) return null;
  const { winner, scores, endReason, rematch } = state;
  const youWon = winner && winner === me?.color;
  const draw = winner === 'draw';
  const title = draw ? "It's a draw" : youWon ? 'You win!' : `${opponent?.name ?? 'Opponent'} wins`;
  const reasonText =
    endReason && endReason !== 'normal'
      ? (youWon ? WIN_REASONS : LOSS_REASONS)[endReason]
      : draw
        ? 'Perfectly balanced.'
        : youWon
          ? 'Nicely played.'
          : 'Better luck next round.';
  const opponentGone = !opponent || opponent.left;

  let rematchLabel = 'Rematch';
  if (rematch.youRequested) rematchLabel = 'Waiting for opponent…';
  else if (rematch.opponentRequested) rematchLabel = 'Accept rematch';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-over-title"
            initial={{ y: 30, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="glass w-full max-w-sm rounded-3xl p-6 text-center"
          >
            <div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
                youWon ? 'bg-accent/15 text-accent' : 'bg-white/[0.06] text-ink-300'
              }`}
            >
              <TrophyIcon width={26} height={26} />
            </div>
            <h2 id="game-over-title" className="text-2xl font-bold tracking-tight text-ink-100">
              {title}
            </h2>
            <p className="mt-1 text-sm text-ink-400">{reasonText}</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {['black', 'white'].map((c) => {
                const p = [me, opponent].find((x) => x?.color === c);
                return (
                  <div
                    key={c}
                    className={`rounded-2xl border p-3 ${winner === c ? 'border-accent/40 bg-accent/[0.06]' : 'border-white/[0.06] bg-ink-950/40'}`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <DiscIcon color={c} size={14} />
                      <span className="truncate text-xs text-ink-300">{p?.isYou ? 'You' : (p?.name ?? c)}</span>
                    </div>
                    <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-ink-100">{scores[c]}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                ref={primaryRef}
                size="lg"
                onClick={onRematch}
                disabled={opponentGone || rematch.youRequested}
                loading={rematch.youRequested}
              >
                {opponentGone ? 'Opponent has left' : rematchLabel}
              </Button>
              {!opponentGone && !rematch.youRequested && (
                <p className="text-xs text-ink-500">Both players must accept. Colors swap.</p>
              )}
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={onClose}>
                  View board
                </Button>
                <Button variant="secondary" onClick={onHome}>
                  Back to home
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
