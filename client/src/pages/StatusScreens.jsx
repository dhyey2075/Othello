import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext.jsx';
import { Header } from '../components/Header.jsx';
import { Button } from '../components/ui/Button.jsx';

function Centered({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass w-full max-w-sm rounded-3xl p-7 text-center"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

export function RestoringScreen() {
  const { session, connection, leaveGame } = useGame();
  return (
    <Centered>
      <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-accent" aria-hidden />
      <h1 className="text-lg font-semibold text-ink-100" role="status">
        Restoring your game…
      </h1>
      <p className="mt-1.5 text-sm text-ink-400">
        {connection === 'connected'
          ? `Rejoining room ${session?.roomCode}.`
          : 'Connecting to the game server. Your seat is being held.'}
      </p>
      <Button variant="ghost" size="sm" className="mt-6" onClick={leaveGame}>
        Abandon and go home
      </Button>
    </Centered>
  );
}

export function ReplacedScreen() {
  const { takeOverSession, leaveGame } = useGame();
  return (
    <Centered>
      <h1 className="text-lg font-semibold text-ink-100">Game opened in another tab</h1>
      <p className="mt-1.5 text-sm text-ink-400">
        This game is now active somewhere else, so this tab was disconnected to keep the session consistent.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button onClick={takeOverSession}>Play here instead</Button>
        <Button variant="ghost" onClick={leaveGame}>
          Leave game
        </Button>
      </div>
    </Centered>
  );
}
