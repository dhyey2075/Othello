import { useEffect, useState } from 'react';
import { soundManager } from '../lib/sound/SoundManager.js';

/** Reactive access to the persisted sound preferences. */
export function useSound() {
  const [prefs, setPrefs] = useState(soundManager.getPrefs());
  useEffect(() => soundManager.subscribe(setPrefs), []);
  return {
    ...prefs,
    setVolume: (v) => soundManager.setVolume(v),
    setMuted: (m) => soundManager.setMuted(m),
    toggleMuted: () => soundManager.setMuted(!soundManager.muted),
  };
}
