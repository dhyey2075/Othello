import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext.jsx';
import { Header } from '../components/Header.jsx';
import { Button } from '../components/ui/Button.jsx';
import { DiscIcon } from '../components/ui/DiscIcon.jsx';
import { CheckIcon, CopyIcon, LinkIcon } from '../components/ui/icons.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLatestDefined } from '../hooks/useLatest.js';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts (e.g. LAN IP over http).
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function LobbyPage() {
  const game = useGame();
  const state = useLatestDefined(game.state);
  const me = useLatestDefined(game.me);
  const { leaveGame } = game;
  const { push } = useToast();
  const [copied, setCopied] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const code = state.roomCode;
  const inviteUrl = `${window.location.origin}/?join=${code}`;

  const copy = async (what) => {
    const ok = await copyText(what === 'code' ? code : inviteUrl);
    if (ok) {
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } else {
      push({ type: 'error', title: 'Copy failed', description: 'Select the code and copy it manually.' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass w-full rounded-3xl p-6 text-center sm:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Your room code</p>
          <div className="mt-4 flex justify-center gap-1.5 sm:gap-2" aria-label={`Room code ${code.split('').join(' ')}`}>
            {code.split('').map((ch, i) => (
              <motion.span
                key={i}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.05 * i, type: 'spring', stiffness: 400, damping: 26 }}
                className="flex h-14 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-ink-950/70 font-mono text-2xl font-bold text-ink-100 sm:h-16 sm:w-12 sm:text-3xl"
                aria-hidden
              >
                {ch}
              </motion.span>
            ))}
          </div>

          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => copy('code')} aria-label="Copy room code">
              {copied === 'code' ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
              {copied === 'code' ? 'Copied' : 'Copy code'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => copy('link')} aria-label="Copy invite link">
              {copied === 'link' ? <CheckIcon width={16} height={16} /> : <LinkIcon width={16} height={16} />}
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </Button>
          </div>

          <div className="my-8 flex flex-col items-center gap-4" role="status" aria-live="polite">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-full border border-accent/40" />
              <span className="absolute inset-0 animate-pulse-ring rounded-full border border-accent/30 [animation-delay:0.9s]" />
              <motion.span
                animate={{ rotateY: [0, 180, 360] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                <DiscIcon color={me?.color} size={34} />
              </motion.span>
            </div>
            <div>
              <p className="font-semibold text-ink-100">Waiting for opponent…</p>
              <p className="mt-1 text-sm text-ink-400">Share the code — the game starts as soon as they join.</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-ink-950/40 px-4 py-3 text-sm text-ink-300">
            <DiscIcon color={me?.color} size={16} />
            You&apos;ll play <span className="font-semibold capitalize text-ink-100">{me?.color}</span>
            {me?.color === 'black' ? ' and move first.' : '. Black moves first.'}
          </div>

          <Button
            variant="ghost"
            className="mt-5"
            loading={leaving}
            onClick={async () => {
              setLeaving(true);
              await leaveGame();
            }}
          >
            Cancel game
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
