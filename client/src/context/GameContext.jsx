import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { emitWithAck, socket } from '../lib/socket/socket.js';
import { clearSession, loadHints, loadSession, saveHints, saveSession } from '../lib/session.js';
import { soundManager } from '../lib/sound/SoundManager.js';
import { DROP_DURATION, FLIP_DURATION, FLIP_STAGGER, FLIP_START } from '../lib/timing.js';
import { useToast } from './ToastContext.jsx';

const GameContext = createContext(null);

/** Errors after which a stored session can never be resumed. */
const FATAL_REJOIN_CODES = new Set(['ROOM_NOT_FOUND', 'ROOM_EXPIRED', 'INVALID_TOKEN', 'INVALID_PAYLOAD']);
const INVALID_MOVE_CODES = new Set(['ILLEGAL_MOVE', 'NOT_YOUR_TURN', 'GAME_PAUSED', 'GAME_NOT_ACTIVE']);

const colorName = (c) => (c === 'black' ? 'Black' : 'White');

function buildAnimation(move) {
  // Discs further from the placed disc flip later, producing an outward ripple.
  const flipped = move.flipped.map(({ row, col }) => {
    const distance = Math.max(Math.abs(row - move.row), Math.abs(col - move.col));
    return { row, col, delay: FLIP_START + (distance - 1) * FLIP_STAGGER };
  });
  return { id: `${move.row}-${move.col}-${Date.now()}`, row: move.row, col: move.col, color: move.color, flipped };
}

function initialState() {
  const session = loadSession();
  return {
    connection: 'connecting', // connecting | connected | reconnecting | offline
    everConnected: false,
    session,
    restoring: Boolean(session),
    state: null,
    clockOffset: 0,
    anim: null,
    replaced: false,
    pendingMove: false,
    showHints: loadHints(),
  };
}

function reducer(s, action) {
  switch (action.type) {
    case 'CONNECTION':
      return {
        ...s,
        connection: action.status,
        everConnected: s.everConnected || action.status === 'connected',
        pendingMove: action.status === 'connected' ? s.pendingMove : false,
      };
    case 'SESSION':
      return { ...s, session: action.session };
    case 'STATE': {
      const newRound = s.state && action.state.round !== s.state.round;
      return {
        ...s,
        state: action.state,
        restoring: false,
        clockOffset: action.state.serverTime - Date.now(),
        anim: newRound ? null : s.anim,
      };
    }
    case 'MOVE':
      return {
        ...s,
        state: action.state,
        anim: buildAnimation(action.move),
        clockOffset: action.state.serverTime - Date.now(),
        pendingMove: false,
      };
    case 'PENDING':
      return { ...s, pendingMove: action.value };
    case 'REPLACED':
      return { ...s, replaced: true, pendingMove: false };
    case 'TAKE_OVER':
      return { ...s, replaced: false, restoring: Boolean(s.session) };
    case 'HINTS':
      return { ...s, showHints: action.value };
    case 'RESET':
      return { ...s, session: null, state: null, anim: null, restoring: false, replaced: false, pendingMove: false };
    default:
      return s;
  }
}

export function GameProvider({ children }) {
  const [s, dispatch] = useReducer(reducer, undefined, initialState);
  const { push } = useToast();
  const ref = useRef(s);
  ref.current = s;
  const pushRef = useRef(push);
  pushRef.current = push;

  const resetToHome = useCallback(() => {
    clearSession();
    dispatch({ type: 'RESET' });
  }, []);

  /* --------------------------- socket wiring --------------------------- */

  useEffect(() => {
    const toast = (t) => pushRef.current(t);
    let rejoinRetry = null;

    const rejoin = async () => {
      const session = ref.current.session;
      if (!session || ref.current.replaced) return;
      try {
        const res = await emitWithAck('rejoin_room', {
          roomCode: session.roomCode,
          playerToken: session.playerToken,
        });
        saveSession({ roomCode: res.roomCode, playerToken: res.playerToken, playerName: res.playerName });
        dispatch({ type: 'STATE', state: res.state });
      } catch (err) {
        if (FATAL_REJOIN_CODES.has(err.code)) {
          clearSession();
          dispatch({ type: 'RESET' });
          const title =
            err.code === 'ROOM_EXPIRED'
              ? 'That game has expired'
              : err.code === 'ROOM_NOT_FOUND'
                ? 'Room no longer exists'
                : 'Your seat is no longer available';
          toast({ type: 'warning', title, description: 'You have been returned to the home screen.', key: 'rejoin' });
        } else if (socket.connected) {
          clearTimeout(rejoinRetry);
          rejoinRetry = setTimeout(rejoin, 2000);
        }
      }
    };

    const onConnect = () => {
      const wasReconnecting = ref.current.everConnected && ref.current.connection !== 'connected';
      dispatch({ type: 'CONNECTION', status: 'connected' });
      if (wasReconnecting && ref.current.state) {
        soundManager.reconnect();
        toast({ type: 'success', title: 'Reconnected', key: 'conn', duration: 2200 });
      }
      rejoin();
    };

    const onDisconnect = (reason) => {
      if (reason === 'io client disconnect') {
        dispatch({ type: 'CONNECTION', status: 'offline' });
        return;
      }
      dispatch({ type: 'CONNECTION', status: 'reconnecting' });
      if (ref.current.state) soundManager.disconnect();
    };

    const onConnectError = () => {
      if (ref.current.connection !== 'reconnecting') dispatch({ type: 'CONNECTION', status: 'reconnecting' });
    };

    const onGameState = (state) => {
      const prev = ref.current.state;
      dispatch({ type: 'STATE', state });
      if (!prev) return;
      const me = state.you?.color;
      if (prev.status === 'finished' && state.status === 'playing') {
        toast({
          type: 'success',
          title: 'Rematch started',
          description: `You're playing ${colorName(me)} this round.`,
          key: 'rematch',
        });
        if (state.turn === me) soundManager.yourTurn(0.2);
      } else if (
        state.status === 'playing' &&
        prev.paused &&
        !state.paused &&
        state.turn === me
      ) {
        soundManager.yourTurn(0.1);
      }
    };

    const onMoveMade = ({ move, state }) => {
      dispatch({ type: 'MOVE', move, state });
      const anim = buildAnimation(move);
      soundManager.place(DROP_DURATION * 0.55);
      anim.flipped
        .slice()
        .sort((a, b) => a.delay - b.delay)
        .forEach((f, i) => soundManager.flip(i, f.delay + FLIP_DURATION * 0.4 + i * 0.012));

      const me = state.you?.color;
      if (move.passed) {
        const passer = state.players.find((p) => p.color === move.passed);
        const mover = state.players.find((p) => p.color === move.color);
        toast({
          type: 'info',
          title: `${passer?.isYou ? 'You have' : `${passer?.name ?? colorName(move.passed)} has`} no legal moves`,
          description: `${mover?.isYou ? 'You play' : `${mover?.name ?? colorName(move.color)} plays`} again.`,
          key: 'pass',
        });
      }
      if (!move.gameOver && state.turn === me) {
        const lastFlip = anim.flipped.reduce((m, f) => Math.max(m, f.delay), 0);
        soundManager.yourTurn(lastFlip + FLIP_DURATION + 0.1);
      }
    };

    const onGameOver = ({ winner }) => {
      const me = ref.current.state?.you?.color;
      const at = 0.9;
      if (winner === 'draw') soundManager.draw(at);
      else if (winner === me) soundManager.win(at);
      else soundManager.lose(at);
    };

    const onOpponentStatus = ({ status, name, graceMs }) => {
      const who = name || 'Your opponent';
      switch (status) {
        case 'joined':
          soundManager.joined();
          toast({ type: 'success', title: `${who} joined`, description: "Let's play!", key: 'opp' });
          break;
        case 'disconnected':
          soundManager.disconnect();
          toast({
            type: 'warning',
            title: 'Opponent disconnected',
            description: `Waiting up to ${Math.round((graceMs ?? 60000) / 1000)}s for ${who} to reconnect.`,
            key: 'opp',
            duration: 5000,
          });
          break;
        case 'reconnected':
          soundManager.reconnect();
          toast({ type: 'success', title: `${who} is back`, description: 'The game has resumed.', key: 'opp' });
          break;
        case 'timeout':
          soundManager.notify();
          toast({
            type: 'warning',
            title: `${who} didn't come back`,
            description: 'You can claim the win or keep waiting.',
            key: 'opp',
            duration: 6000,
          });
          break;
        case 'left':
          soundManager.disconnect();
          toast({ type: 'info', title: `${who} left the game`, key: 'opp' });
          break;
        default:
          break;
      }
    };

    const onRematchOffered = ({ name }) => {
      soundManager.notify();
      toast({ type: 'info', title: `${name || 'Your opponent'} wants a rematch`, key: 'rematch' });
    };

    const onSessionReplaced = () => {
      dispatch({ type: 'REPLACED' });
      // Stop auto-reconnecting so this tab doesn't steal the seat back.
      socket.disconnect();
    };

    const onRoomClosed = ({ reason }) => {
      if (ref.current.replaced) return;
      clearSession();
      dispatch({ type: 'RESET' });
      const description =
        reason === 'finished'
          ? 'Finished games are cleaned up after a while.'
          : reason === 'left'
            ? 'You left this game from another tab.'
            : 'The game was inactive for too long.';
      toast({ type: 'info', title: 'This game was closed', description, key: 'closed' });
    };

    const onError = ({ code, message }) => {
      dispatch({ type: 'PENDING', value: false });
      if (INVALID_MOVE_CODES.has(code)) soundManager.invalid();
      toast({ type: 'error', title: message || 'Something went wrong', key: `err-${code}`, duration: 2800 });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('game_state', onGameState);
    socket.on('move_made', onMoveMade);
    socket.on('game_over', onGameOver);
    socket.on('opponent_status', onOpponentStatus);
    socket.on('rematch_offered', onRematchOffered);
    socket.on('session_replaced', onSessionReplaced);
    socket.on('room_closed', onRoomClosed);
    socket.on('error_message', onError);

    if (socket.connected) onConnect();
    else if (!ref.current.replaced) socket.connect();

    return () => {
      clearTimeout(rejoinRetry);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('game_state', onGameState);
      socket.off('move_made', onMoveMade);
      socket.off('game_over', onGameOver);
      socket.off('opponent_status', onOpponentStatus);
      socket.off('rematch_offered', onRematchOffered);
      socket.off('session_replaced', onSessionReplaced);
      socket.off('room_closed', onRoomClosed);
      socket.off('error_message', onError);
    };
  }, []);

  /* ------------------------------ actions ------------------------------ */

  const adoptSession = useCallback((res) => {
    const session = { roomCode: res.roomCode, playerToken: res.playerToken, playerName: res.playerName };
    saveSession(session);
    dispatch({ type: 'SESSION', session });
    dispatch({ type: 'STATE', state: res.state });
  }, []);

  const createRoom = useCallback(
    async ({ playerName, color }) => {
      const res = await emitWithAck('create_room', { playerName, color });
      adoptSession(res);
      return res;
    },
    [adoptSession],
  );

  const joinRoom = useCallback(
    async ({ roomCode, playerName }) => {
      const stored = loadSession();
      const playerToken = stored && stored.roomCode === roomCode ? stored.playerToken : undefined;
      const res = await emitWithAck('join_room', { roomCode, playerName, playerToken });
      adoptSession(res);
      return res;
    },
    [adoptSession],
  );

  const makeMove = useCallback((row, col) => {
    const { state, pendingMove, connection } = ref.current;
    if (!state || pendingMove) return; // swallow double-clicks while a move is in flight
    const me = state.you?.color;
    const toast = pushRef.current;
    if (state.status !== 'playing') return;
    if (connection !== 'connected') {
      soundManager.invalid();
      toast({ type: 'warning', title: 'You are offline', description: 'Reconnecting…', key: 'offline' });
      return;
    }
    if (state.paused) {
      soundManager.invalid();
      toast({ type: 'warning', title: 'Game paused', description: 'Waiting for your opponent to reconnect.', key: 'paused' });
      return;
    }
    if (state.turn !== me) {
      soundManager.invalid();
      toast({ type: 'info', title: "It's your opponent's turn", key: 'turn', duration: 1800 });
      return;
    }
    if (!state.validMoves.some((m) => m.row === row && m.col === col)) {
      soundManager.invalid();
      return;
    }
    dispatch({ type: 'PENDING', value: true });
    emitWithAck('make_move', { row, col })
      .catch(() => {})
      .finally(() => dispatch({ type: 'PENDING', value: false }));
  }, []);

  const requestRematch = useCallback(async () => {
    try {
      await emitWithAck('request_rematch');
    } catch (err) {
      pushRef.current({ type: 'error', title: err.message, key: 'rematch' });
    }
  }, []);

  const claimWin = useCallback(async () => {
    try {
      await emitWithAck('claim_win');
    } catch (err) {
      pushRef.current({ type: 'error', title: err.message, key: 'claim' });
    }
  }, []);

  const leaveGame = useCallback(async () => {
    const session = ref.current.session;
    if (session && socket.connected) {
      try {
        await emitWithAck('leave_room', { roomCode: session.roomCode, playerToken: session.playerToken }, 4000);
      } catch {
        /* the room may already be gone — leaving locally is what matters */
      }
    }
    resetToHome();
  }, [resetToHome]);

  const takeOverSession = useCallback(() => {
    dispatch({ type: 'TAKE_OVER' });
    // Let the state update land before `connect` fires so rejoin isn't skipped.
    setTimeout(() => socket.connect(), 0);
  }, []);

  const setShowHints = useCallback((value) => {
    saveHints(value);
    dispatch({ type: 'HINTS', value });
  }, []);

  /* ------------------------------ derived ------------------------------ */

  const value = useMemo(() => {
    const state = s.state;
    const me = state?.players.find((p) => p.isYou) ?? null;
    const opponent = state?.players.find((p) => !p.isYou) ?? null;
    const isMyTurn = Boolean(state && state.status === 'playing' && state.turn === me?.color);
    const canPlay = isMyTurn && !state.paused && !s.pendingMove && s.connection === 'connected';
    return {
      ...s,
      me,
      opponent,
      isMyTurn,
      canPlay,
      createRoom,
      joinRoom,
      makeMove,
      requestRematch,
      claimWin,
      leaveGame,
      takeOverSession,
      setShowHints,
    };
  }, [s, createRoom, joinRoom, makeMove, requestRematch, claimWin, leaveGame, takeOverSession, setShowHints]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
