import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { GameProvider, useGame } from './context/GameContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { Toaster } from './components/Toaster.jsx';
import { ConnectionBanner } from './components/ConnectionBanner.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LobbyPage } from './pages/LobbyPage.jsx';
import { GamePage } from './pages/GamePage.jsx';
import { ReplacedScreen, RestoringScreen } from './pages/StatusScreens.jsx';

function Screens() {
  const { state, restoring, replaced } = useGame();

  let key = 'home';
  let screen = <HomePage />;
  if (replaced) {
    key = 'replaced';
    screen = <ReplacedScreen />;
  } else if (restoring && !state) {
    key = 'restoring';
    screen = <RestoringScreen />;
  } else if (state?.status === 'waiting') {
    key = `lobby-${state.roomCode}`;
    screen = <LobbyPage />;
  } else if (state) {
    key = `game-${state.roomCode}`;
    screen = <GamePage />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.2, 0.7, 0.3, 1] }}
      >
        {screen}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <GameProvider>
          <Screens />
          <ConnectionBanner />
          <Toaster />
        </GameProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
