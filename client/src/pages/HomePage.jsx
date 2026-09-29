import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext.jsx';
import { loadName, saveName } from '../lib/session.js';
import { Header } from '../components/Header.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Segmented } from '../components/ui/Segmented.jsx';
import { DiscIcon } from '../components/ui/DiscIcon.jsx';

const CODE_ALPHABET = /[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;
const ERROR_TEXT = {
  ROOM_NOT_FOUND: 'No game found with that code. Check for typos.',
  ROOM_EXPIRED: 'That game has expired. Ask your friend for a new code.',
  ROOM_FULL: 'That game already has two players.',
  OFFLINE: "Can't reach the game server right now.",
  TIMEOUT: 'The server took too long to respond. Try again.',
};

const sanitizeCode = (v) =>
  v
    .toUpperCase()
    .replace(CODE_ALPHABET, '')
    .slice(0, 6);

export function HomePage() {
  const { createRoom, joinRoom, connection } = useGame();
  const [name, setName] = useState(loadName());
  const [color, setColor] = useState('random');
  const [code, setCode] = useState(() => sanitizeCode(new URLSearchParams(window.location.search).get('join') ?? ''));
  const [busy, setBusy] = useState(null);
  const [joinError, setJoinError] = useState('');
  const [createError, setCreateError] = useState('');
  const offline = connection !== 'connected';

  const commitName = () => saveName(name.trim());

  const onCreate = async () => {
    setCreateError('');
    setBusy('create');
    commitName();
    try {
      await createRoom({ playerName: name.trim() || undefined, color });
    } catch (err) {
      setCreateError(ERROR_TEXT[err.code] ?? err.message);
    } finally {
      setBusy(null);
    }
  };

  const onJoin = async (e) => {
    e.preventDefault();
    setJoinError('');
    if (code.length !== 6) {
      setJoinError('Room codes are 6 characters.');
      return;
    }
    setBusy('join');
    commitName();
    try {
      await joinRoom({ roomCode: code, playerName: name.trim() || undefined });
    } catch (err) {
      setJoinError(ERROR_TEXT[err.code] ?? err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-16 pt-6 sm:px-6 sm:pt-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.7, 0.3, 1] }}
          className="text-center"
        >
          <div className="mb-6 flex justify-center gap-2" aria-hidden>
            {['black', 'white', 'white', 'black'].map((c, i) => (
              <motion.span
                key={i}
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
              >
                <DiscIcon color={c} size={22} />
              </motion.span>
            ))}
          </div>
          <h1 className="text-balance text-4xl font-extrabold tracking-tight text-ink-100 sm:text-5xl">
            Othello, face to face.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-balance text-ink-300">
            Start a game, share the six-letter code, and play a friend in real time. Refresh or drop Wi-Fi — your seat is
            held for you.
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.2, 0.7, 0.3, 1] }}
          className="glass mt-10 w-full max-w-3xl rounded-3xl p-5 sm:p-7"
        >
          <Input
            label="Your name"
            placeholder="e.g. Ada"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            autoComplete="nickname"
            hint="Optional — shown to your opponent."
          />

          <div className="mt-6 grid gap-6 md:grid-cols-2 md:gap-0">
            <div className="md:pr-7">
              <h2 className="text-lg font-semibold text-ink-100">Create a game</h2>
              <p className="mt-1 text-sm text-ink-400">You&apos;ll get a code to send to your opponent.</p>
              <div className="mt-4">
                <Segmented
                  label="Play as"
                  value={color}
                  onChange={setColor}
                  options={[
                    { value: 'random', label: 'Random', icon: <DiscIcon color="random" size={12} /> },
                    { value: 'black', label: 'Black', icon: <DiscIcon color="black" size={12} /> },
                    { value: 'white', label: 'White', icon: <DiscIcon color="white" size={12} /> },
                  ]}
                />
              </div>
              <Button size="lg" className="mt-5 w-full" onClick={onCreate} loading={busy === 'create'} disabled={offline || Boolean(busy)}>
                Create game
              </Button>
              {createError && (
                <p className="mt-2 text-xs text-rose-300" role="alert">
                  {createError}
                </p>
              )}
            </div>

            <div className="relative md:border-l md:border-white/[0.06] md:pl-7">
              <div className="mb-6 flex items-center gap-3 md:hidden" aria-hidden>
                <span className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-xs uppercase tracking-widest text-ink-500">or</span>
                <span className="h-px flex-1 bg-white/[0.06]" />
              </div>
              <h2 className="text-lg font-semibold text-ink-100">Join a game</h2>
              <p className="mt-1 text-sm text-ink-400">Enter the code your friend shared.</p>
              <form onSubmit={onJoin} className="mt-4">
                <label htmlFor="room-code" className="label">
                  Room code
                </label>
                <input
                  id="room-code"
                  value={code}
                  onChange={(e) => {
                    setCode(sanitizeCode(e.target.value));
                    setJoinError('');
                  }}
                  placeholder="ABC234"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(joinError)}
                  aria-describedby={joinError ? 'join-error' : undefined}
                  className={`h-[52px] w-full rounded-xl border bg-ink-950/60 px-4 text-center font-mono text-2xl font-bold uppercase tracking-[0.45em] text-ink-100 placeholder:text-ink-600 focus:outline-none focus:ring-2 focus:ring-accent/60 ${
                    joinError ? 'border-rose-400/50' : 'border-white/[0.08]'
                  }`}
                />
                {joinError && (
                  <p id="join-error" className="mt-2 text-xs text-rose-300" role="alert">
                    {joinError}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="secondary"
                  size="lg"
                  className="mt-5 w-full"
                  loading={busy === 'join'}
                  disabled={offline || Boolean(busy) || code.length !== 6}
                >
                  Join game
                </Button>
              </form>
            </div>
          </div>
        </motion.section>

        <p className="mt-8 max-w-md text-center text-xs leading-relaxed text-ink-500">
          Place a disc to trap your opponent&apos;s discs between yours — they flip to your color. No legal move? Your
          turn passes. Most discs when the board locks up wins.
        </p>
      </main>
    </div>
  );
}
