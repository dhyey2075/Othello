import { SoundControls } from './SoundControls.jsx';

export function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-7 w-10 items-center" aria-hidden>
        <span className="absolute left-0 h-7 w-7 rounded-full bg-gradient-to-br from-zinc-600 to-black shadow-md ring-1 ring-white/10" />
        <span className="absolute left-3 h-7 w-7 rounded-full bg-gradient-to-br from-white to-stone-300 shadow-md" />
      </span>
      <span className="text-lg font-bold tracking-tight text-ink-100">Othello</span>
    </div>
  );
}

export function Header({ children }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <Logo />
      <div className="flex items-center gap-1.5">
        {children}
        <SoundControls />
      </div>
    </header>
  );
}
