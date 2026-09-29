import { motion } from 'framer-motion';
import { DiscIcon } from './ui/DiscIcon.jsx';

function statusOf(player) {
  if (!player) return { dot: 'bg-ink-500', text: 'Waiting…' };
  if (player.left) return { dot: 'bg-ink-500', text: 'Left the game' };
  if (!player.connected) return { dot: 'bg-accent animate-pulse', text: 'Reconnecting…' };
  return { dot: 'bg-emerald-400', text: 'Online' };
}

export function PlayerCard({ player, score, active, compact = false }) {
  const status = statusOf(player);
  const initial = (player?.name?.trim()?.[0] ?? '?').toUpperCase();
  const color = player?.color;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-colors duration-300 ${
        active ? 'border-accent/50 bg-accent/[0.06]' : 'border-white/[0.06] bg-ink-900/60'
      } ${compact ? 'p-3' : 'p-4'}`}
      aria-label={`${player?.name ?? 'Opponent'}${player?.isYou ? ' (you)' : ''}, ${color ?? ''}, ${score} discs${active ? ', to move' : ''}`}
    >
      {active && (
        <motion.span
          layoutId="turn-indicator"
          className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-accent"
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        />
      )}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={`flex items-center justify-center rounded-full font-bold ${compact ? 'h-9 w-9 text-sm' : 'h-11 w-11'} ${
              color === 'black' ? 'bg-ink-950 text-ink-100 ring-1 ring-white/15' : 'bg-stone-100 text-ink-950'
            }`}
            aria-hidden
          >
            {initial}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-ink-900 ${status.dot}`}
            title={status.text}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`truncate font-semibold text-ink-100 ${compact ? 'text-sm' : ''}`}>{player?.name ?? 'Opponent'}</p>
            {player?.isYou && (
              <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-300">
                You
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-400">
            {active ? <span className="font-medium text-accent">{player?.isYou ? 'Your move' : 'Thinking…'}</span> : status.text}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DiscIcon color={color} size={compact ? 16 : 20} />
          <motion.span
            key={score}
            initial={{ scale: 1.35, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`min-w-[2ch] text-right font-mono font-bold tabular-nums text-ink-100 ${compact ? 'text-lg' : 'text-2xl'}`}
          >
            {score}
          </motion.span>
        </div>
      </div>
    </div>
  );
}
