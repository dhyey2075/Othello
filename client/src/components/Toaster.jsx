import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '../context/ToastContext.jsx';

const TONES = {
  info: 'bg-sky-400',
  success: 'bg-emerald-400',
  warning: 'bg-accent',
  error: 'bg-rose-400',
};

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:top-5"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            role={t.type === 'error' ? 'alert' : 'status'}
            className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3"
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONES[t.type] ?? TONES.info}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-100">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs leading-relaxed text-ink-300">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-mr-1 rounded-lg px-1.5 text-lg leading-none text-ink-400 hover:text-ink-100"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
