import { Component, Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { BoardScene } from './BoardScene.jsx';
import { BoardA11yGrid } from './BoardA11yGrid.jsx';
import { useCanHover, useReducedMotion } from '../../hooks/useMediaQuery.js';

class WebGLBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error('3D board crashed:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-3xl border border-white/5 bg-ink-900 p-6 text-center text-sm text-ink-300">
          <p>
            The 3D board stopped rendering. If this keeps happening, enable hardware acceleration or try a recent
            Chrome, Firefox or Safari.
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ failed: false });
              this.props.onRetry?.();
            }}
            className="rounded-xl bg-white/[0.08] px-4 py-2 font-semibold text-ink-100 hover:bg-white/[0.12]"
          >
            Reload board
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function BoardLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
    </div>
  );
}

export function Board3D({ board, validMoves, lastMove, anim, myColor, canPlay, showHints, onPlay }) {
  const [hover, setHover] = useState(null);
  const [focused, setFocused] = useState(null);
  const [ready, setReady] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const remount = () => {
    setReady(false);
    setCanvasKey((k) => k + 1);
  };
  const reducedMotion = useReducedMotion();
  const canHover = useCanHover();
  const parallax = canHover && !reducedMotion;

  const hoverLegal = hover && canPlay && validMoves.some((m) => m.row === hover.row && m.col === hover.col);
  useEffect(() => {
    document.body.style.cursor = hoverLegal ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hoverLegal]);

  return (
    <div className="relative aspect-square w-full select-none" onPointerLeave={() => setHover(null)}>
      <WebGLBoundary onRetry={remount}>
        {!ready && <BoardLoading />}
        <Canvas
          key={canvasKey}
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 13.4, 8.6], fov: 38, near: 0.1, far: 60 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ camera, gl }) => {
            camera.lookAt(0, -0.7, 0.55);
            setReady(true);
            // three.js tries to restore a lost context; if the browser doesn't, rebuild the canvas.
            const canvas = gl.domElement;
            let timer;
            canvas.addEventListener('webglcontextlost', () => {
              timer = setTimeout(remount, 2500);
            });
            canvas.addEventListener('webglcontextrestored', () => clearTimeout(timer));
          }}
          aria-hidden="true"
          className="rounded-3xl"
        >
          <Suspense fallback={null}>
            <BoardScene
              board={board}
              validMoves={validMoves}
              lastMove={lastMove}
              anim={anim}
              myColor={myColor}
              canPlay={canPlay}
              showHints={showHints}
              hover={hover}
              focused={focused}
              parallax={parallax}
              reducedMotion={reducedMotion}
              onHover={setHover}
              onPlay={onPlay}
            />
          </Suspense>
        </Canvas>
      </WebGLBoundary>
      <BoardA11yGrid
        board={board}
        validMoves={validMoves}
        canPlay={canPlay}
        focused={focused}
        onFocusCell={setFocused}
        onPlay={onPlay}
      />
    </div>
  );
}
