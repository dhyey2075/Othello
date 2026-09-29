import { forwardRef, useId } from 'react';

export const Input = forwardRef(function Input({ label, hint, error, className = '', id, ...props }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`h-11 w-full rounded-xl border bg-ink-950/60 px-3.5 text-sm text-ink-100 placeholder:text-ink-500 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/60 ${
          error ? 'border-rose-400/50' : 'border-white/[0.08] hover:border-white/[0.14]'
        }`}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-rose-300" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-ink-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
