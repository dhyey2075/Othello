import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../context/GameContext.jsx';
import { WifiOffIcon } from './ui/icons.jsx';

/** Subtle bottom banner shown while Socket.IO is retrying with backoff. */
export function ConnectionBanner() {
  const { connection, everConnected, replaced } = useGame();
  const show = !replaced && connection === 'reconnecting';
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
          role="status"
        >
          <div className="glass flex items-center gap-2.5 rounded-full px-4 py-2 text-sm text-ink-200">
            <WifiOffIcon className="text-accent" width={16} height={16} />
            <span>{everConnected ? 'Connection lost — reconnecting…' : "Can't reach the game server — retrying…"}</span>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15 border-t-accent" aria-hidden />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
