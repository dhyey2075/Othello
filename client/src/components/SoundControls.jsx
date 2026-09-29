import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSound } from '../hooks/useSound.js';
import { soundManager } from '../lib/sound/SoundManager.js';
import { MuteIcon, VolumeIcon } from './ui/icons.jsx';

export function SoundControls() {
  const { muted, volume, setVolume, toggleMuted } = useSound();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const silent = muted || volume === 0;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Sound settings"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-100"
      >
        {silent ? <MuteIcon /> : <VolumeIcon />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="glass absolute right-0 top-11 z-40 w-60 rounded-2xl p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-100">Sound</span>
              <button
                type="button"
                role="switch"
                aria-checked={!muted}
                aria-label={muted ? 'Unmute' : 'Mute'}
                onClick={() => {
                  toggleMuted();
                  if (muted) setTimeout(() => soundManager.place(), 30);
                }}
                className={`relative h-6 w-11 rounded-full transition-colors ${muted ? 'bg-ink-600' : 'bg-accent'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    muted ? 'translate-x-0.5' : 'translate-x-[22px]'
                  }`}
                />
              </button>
            </div>
            <label className="label" htmlFor="volume">
              Volume {Math.round(volume * 100)}%
            </label>
            <input
              id="volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              onPointerUp={() => soundManager.place()}
              onKeyUp={() => soundManager.place()}
              className="w-full"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
