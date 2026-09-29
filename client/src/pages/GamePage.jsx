import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext.jsx';
import { Header } from '../components/Header.jsx';
import { Board3D } from '../components/board/Board3D.jsx';
import { PlayerCard } from '../components/PlayerCard.jsx';
import { MoveHistory } from '../components/MoveHistory.jsx';
import { GameOverModal } from '../components/GameOverModal.jsx';
import { PauseBanner } from '../components/PauseBanner.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { Button } from '../components/ui/Button.jsx';
import { BulbIcon, LogoutIcon } from '../components/ui/icons.jsx';
import { useLatestDefined } from '../hooks/useLatest.js';

function statusLine({ state, me, opponent, isMyTurn, pendingMove }) {
  if (state.status === 'finished') {
    if (state.winner === 'draw') return 'Game over — draw';
    return state.winner === me?.color ? 'Game over — you won' : `Game over — ${opponent?.name ?? 'opponent'} won`;
  }
  if (state.paused) return 'Paused';
  if (pendingMove) return 'Placing…';
  if (isMyTurn) return state.validMoves.length ? 'Your move' : 'No moves available';
  return `${opponent?.name ?? 'Opponent'} is thinking…`;
}

export function GamePage() {
  const game = useGame();
  const state = useLatestDefined(game.state);
  const me = useLatestDefined(game.me);
  const opponent = useLatestDefined(game.opponent);
  const {
    anim,
    canPlay,
    isMyTurn,
    pendingMove,
    showHints,
    setShowHints,
    makeMove,
    requestRematch,
    claimWin,
    leaveGame,
    clockOffset,
  } = game;

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [keepWaiting, setKeepWaiting] = useState(false);
  const prevStatus = useRef(null);

  // Open the results a beat after the final flip animation; open immediately when restored into a finished game.
  useEffect(() => {
    let t;
    if (state.status === 'finished' && prevStatus.current !== 'finished') {
      t = setTimeout(() => setModalOpen(true), anim ? 1400 : 300);
    } else if (state.status !== 'finished') {
      setModalOpen(false);
    }
    prevStatus.current = state.status;
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  useEffect(() => {
    if (!state.canClaimWin) setKeepWaiting(false);
  }, [state.canClaimWin]);

  const onLeave = async () => {
    setLeaving(true);
    await leaveGame();
  };

  const onPlay = useCallback((row, col) => makeMove(row, col), [makeMove]);
  const scores = state.scores;
  const activeColor = state.status === 'playing' && !state.paused ? state.turn : null;

  const hintsToggle = (
    <button
      type="button"
      role="switch"
      aria-checked={showHints}
      onClick={() => setShowHints(!showHints)}
      className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm transition-colors hover:bg-white/[0.06] ${
        showHints ? 'text-accent' : 'text-ink-400'
      }`}
      title="Show legal move hints"
    >
      <BulbIcon width={16} height={16} />
      <span className="hidden sm:inline">Hints</span>
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header>
        <span className="mr-1 hidden rounded-lg border border-white/[0.06] bg-ink-900/60 px-2.5 py-1 font-mono text-xs font-semibold tracking-widest text-ink-300 sm:inline">
          {state.roomCode}
        </span>
        {hintsToggle}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (state.status === 'playing' ? setConfirmLeave(true) : onLeave())}
          aria-label="Leave game"
        >
          <LogoutIcon width={16} height={16} />
          <span className="hidden sm:inline">Leave</span>
        </Button>
      </Header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-5 px-3 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 lg:hidden">
            <PlayerCard compact player={me} score={me ? scores[me.color] : 0} active={activeColor === me?.color} />
            <PlayerCard
              compact
              player={opponent}
              score={opponent ? scores[opponent.color] : 0}
              active={activeColor === opponent?.color}
            />
          </div>

          <PauseBanner
            opponent={state.status === 'playing' ? opponent : null}
            canClaimWin={state.canClaimWin}
            clockOffset={clockOffset}
            waiting={keepWaiting}
            onClaim={claimWin}
            onKeepWaiting={() => setKeepWaiting(true)}
          />

          <div className="flex items-center justify-center gap-2" aria-live="polite">
            <motion.p
              key={statusLine({ state, me, opponent, isMyTurn, pendingMove })}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-sm font-semibold ${isMyTurn && !state.paused ? 'text-accent' : 'text-ink-300'}`}
            >
              {statusLine({ state, me, opponent, isMyTurn, pendingMove })}
            </motion.p>
            {state.status === 'finished' && !modalOpen && (
              <Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
                Results
              </Button>
            )}
          </div>

          <div className="mx-auto w-full max-w-[min(100%,calc(100svh-230px))] min-w-[280px]">
            <Board3D
              board={state.board}
              validMoves={state.validMoves}
              lastMove={state.lastMove}
              anim={anim}
              myColor={me?.color}
              canPlay={canPlay}
              showHints={showHints}
              onPlay={onPlay}
            />
          </div>

          <div className="lg:hidden">
            <MoveHistory history={state.moveHistory} players={state.players} />
          </div>
        </div>

        <aside className="hidden flex-col gap-3 lg:flex">
          <PlayerCard
            player={opponent}
            score={opponent ? scores[opponent.color] : 0}
            active={activeColor === opponent?.color}
          />
          <PlayerCard player={me} score={me ? scores[me.color] : 0} active={activeColor === me?.color} />
          <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-ink-900/60 px-4 py-3 text-sm">
            <span className="text-ink-400">Round {state.round}</span>
            <span className="font-mono text-ink-300">{64 - scores.black - scores.white} empty</span>
          </div>
          <MoveHistory history={state.moveHistory} players={state.players} />
        </aside>
      </main>

      <GameOverModal
        open={modalOpen && state.status === 'finished'}
        state={state}
        me={me}
        opponent={opponent}
        onRematch={requestRematch}
        onHome={onLeave}
        onClose={() => setModalOpen(false)}
      />
      <ConfirmDialog
        open={confirmLeave}
        title="Leave this game?"
        description="The game is still in progress. Leaving now forfeits — your opponent wins."
        confirmLabel="Leave & forfeit"
        loading={leaving}
        onConfirm={onLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
