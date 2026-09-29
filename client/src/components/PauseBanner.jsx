import { AnimatePresence, motion } from 'framer-motion';
import { useCountdown } from '../hooks/useCountdown.js';
import { Button } from './ui/Button.jsx';

/**
 * Shown while the opponent is disconnected. Counts down the server's grace
 * window; once it expires the player can claim the win or keep waiting.
 */
export function PauseBanner({ opponent, canClaimWin, clockOffset, waiting, onClaim, onKeepWaiting }) {
  const deadline = opponent?.reconnectDeadline ? opponent.reconnectDeadline - clockOffset : null;
  const seconds = useCountdown(deadline);
  const show = opponent && !opponent.connected && !opponent.left;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          className="overflow-hidden"
          role="status"
        >
          <div className="flex flex-col gap-3 rounded-2xl border border-accent/25 bg-accent/[0.07] p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-100">
                {canClaimWin && !waiting ? `${opponent.name} didn't come back` : `${opponent.name} disconnected`}
              </p>
              <p className="mt-0.5 text-xs text-ink-300">
                {canClaimWin
                  ? waiting
                    ? "Still waiting — they can rejoin any time. You can claim the win whenever you're ready."
                    : 'The reconnect window has closed. Claim the win or keep waiting.'
                  : `Game paused. Waiting up to ${seconds ?? '…'}s for them to reconnect.`}
              </p>
            </div>
            {canClaimWin ? (
              <div className="flex gap-2">
                {!waiting && (
                  <Button variant="secondary" size="sm" onClick={onKeepWaiting}>
                    Keep waiting
                  </Button>
                )}
                <Button size="sm" onClick={onClaim}>
                  Claim win
                </Button>
              </div>
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/40 font-mono text-sm font-bold text-accent"
                aria-label={`${seconds} seconds left`}
              >
                {seconds ?? '–'}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
