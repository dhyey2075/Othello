import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  /**
   * push({ title, description?, type?: 'info'|'success'|'warning'|'error', duration?, key? })
   * `key` de-duplicates: a toast with the same key replaces the previous one.
   */
  const push = useCallback(
    ({ title, description, type = 'info', duration = 3800, key }) => {
      const id = nextId++;
      setToasts((list) => {
        const filtered = key ? list.filter((t) => t.key !== key) : list;
        return [...filtered, { id, title, description, type, key }].slice(-4);
      });
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
