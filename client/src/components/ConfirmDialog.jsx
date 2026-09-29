import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './ui/Button.jsx';

export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel, loading }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onCancel()}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            className="glass w-full max-w-sm rounded-3xl p-6"
          >
            <h2 id="confirm-title" className="text-lg font-semibold text-ink-100">
              {title}
            </h2>
            <p id="confirm-desc" className="mt-1.5 text-sm text-ink-300">
              {description}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
                Stay
              </Button>
              <Button variant="danger" onClick={onConfirm} loading={loading}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
