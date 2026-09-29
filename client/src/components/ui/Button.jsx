import { forwardRef } from 'react';

const VARIANTS = {
  primary:
    'bg-accent text-ink-950 hover:bg-accent-soft active:bg-accent-deep shadow-glow disabled:bg-ink-700 disabled:text-ink-400 disabled:shadow-none',
  secondary:
    'bg-white/[0.06] text-ink-100 hover:bg-white/[0.1] active:bg-white/[0.14] border border-white/[0.08] disabled:text-ink-500',
  ghost: 'bg-transparent text-ink-300 hover:text-ink-100 hover:bg-white/[0.06] disabled:text-ink-600',
  danger: 'bg-transparent text-rose-300 hover:bg-rose-500/10 border border-rose-400/20',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-5 text-base rounded-2xl gap-2',
  icon: 'h-9 w-9 rounded-xl',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, className = '', children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={`inline-flex select-none items-center justify-center font-semibold transition-colors duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
});
