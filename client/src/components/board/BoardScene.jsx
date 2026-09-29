import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Disc } from './Disc.jsx';
import { createFeltTexture } from './feltTexture.js';
import {
  DISC_THICKNESS,
  cellHighlightGeometry,
  cellToWorld,
  focusRingGeometry,
  ghostGeometry,
  hintGeometry,
  lastMoveRingGeometry,
} from './geometry.js';

const ACCENT = '#f2b84b';
const ghostMaterials = {
  black: new THREE.MeshStandardMaterial({ color: '#141414', transparent: true, opacity: 0.55, roughness: 0.4 }),
  white: new THREE.MeshStandardMaterial({ color: '#f3f0e8', transparent: true, opacity: 0.55, roughness: 0.4 }),
};
const hintMaterial = new THREE.MeshStandardMaterial({
  color: ACCENT,
  emissive: ACCENT,
  emissiveIntensity: 0.35,
  transparent: true,
  opacity: 0.85,
});
const lastMoveMaterial = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.16, depthWrite: false });
const lastRingMaterial = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9, depthWrite: false });
const focusMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

function FlatOnFelt({ row, col, y = 0.003, children }) {
  const [x, z] = cellToWorld(row, col);
  return (
    <group position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      {children}
    </group>
  );
}

function Ghost({ row, col, color }) {
  const ref = useRef();
  const [x, z] = cellToWorld(row, col);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 0.16 + Math.sin(clock.elapsedTime * 4) * 0.025;
  });
  return <mesh ref={ref} position={[x, 0.16, z]} geometry={ghostGeometry} material={ghostMaterials[color]} />;
}

/**
 * Everything inside the <Canvas>: lighting, board, discs and markers.
 * The whole board group eases toward a small tilt that follows the pointer.
 */
export function BoardScene({
  board,
  validMoves,
  lastMove,
  anim,
  myColor,
  canPlay,
  showHints,
  hover,
  focused,
  parallax,
  reducedMotion,
  onHover,
  onPlay,
}) {
  const tilt = useRef();
  const felt = useMemo(() => createFeltTexture(1024), []);
  const validSet = useMemo(() => new Set(validMoves.map((m) => `${m.row}-${m.col}`)), [validMoves]);
  const flipMap = useMemo(() => {
    const map = new Map();
    if (anim) for (const f of anim.flipped) map.set(`${f.row}-${f.col}`, { delay: f.delay, fromRow: anim.row, fromCol: anim.col });
    return map;
  }, [anim]);

  useFrame(({ pointer, clock }, delta) => {
    const g = tilt.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const targetX = parallax ? pointer.y * -0.05 + Math.sin(t * 0.35) * 0.008 : 0;
    const targetZ = parallax ? pointer.x * -0.04 + Math.cos(t * 0.3) * 0.006 : 0;
    const k = 1 - Math.exp(-delta * 3);
    g.rotation.x += (targetX - g.rotation.x) * k;
    g.rotation.z += (targetZ - g.rotation.z) * k;
  });

  const cellFromEvent = (e) => {
    const local = tilt.current.worldToLocal(e.point.clone());
    const col = Math.floor(local.x + 4);
    const row = Math.floor(local.z + 4);
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    return { row, col };
  };

  const showInteractive = canPlay && myColor;
  const hoverIsLegal = hover && showInteractive && validSet.has(`${hover.row}-${hover.col}`);

  const discs = [];
  if (board) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const color = board[row][col];
        if (!color) continue;
        const key = `${row}-${col}`;
        const isPlaced = anim && anim.row === row && anim.col === col;
        discs.push(
          <Disc
            key={key}
            row={row}
            col={col}
            color={color}
            dropIn={Boolean(isPlaced)}
            flip={flipMap.get(key)}
            reducedMotion={reducedMotion}
          />,
        );
      }
    }
  }

  return (
    <>
      <ambientLight intensity={0.2} />
      <hemisphereLight args={['#e3ecff', '#1a140f', 0.45]} />
      <directionalLight
        position={[3.5, 11, 5.5]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={25}
      />
      <pointLight position={[-6, 4, -4]} intensity={18} color="#f2b84b" distance={18} decay={2} />

      {/* Local environment map built from light panels (no network HDR) for glossy reflections. */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={1.3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
        <Lightformer intensity={0.9} position={[-6, 2, 3]} rotation-y={Math.PI / 2} scale={[8, 1.5, 1]} />
        <Lightformer intensity={0.6} color="#f2b84b" position={[6, 2, -3]} rotation-y={-Math.PI / 2} scale={[8, 1.5, 1]} />
      </Environment>

      <group ref={tilt}>
        {/* Frame */}
        <RoundedBox args={[9.1, 0.6, 9.1]} radius={0.22} smoothness={5} position={[0, -0.31, 0]} receiveShadow castShadow>
          <meshPhysicalMaterial color="#1b1f25" roughness={0.45} metalness={0.25} clearcoat={0.6} clearcoatRoughness={0.3} />
        </RoundedBox>
        {/* Inner lip around the felt for a beveled edge */}
        <mesh position={[0, -0.02, 0]} receiveShadow>
          <boxGeometry args={[8.2, 0.04, 8.2]} />
          <meshStandardMaterial color="#0f1a15" roughness={0.8} />
        </mesh>
        {/* Felt */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
          <planeGeometry args={[8, 8]} />
          <meshPhysicalMaterial
            map={felt}
            roughness={0.85}
            envMapIntensity={0.35}
            sheen={0.6}
            sheenRoughness={0.7}
            sheenColor="#5fbf92"
            clearcoat={0.08}
            clearcoatRoughness={0.7}
          />
        </mesh>

        {lastMove && (
          <FlatOnFelt row={lastMove.row} col={lastMove.col}>
            <mesh geometry={cellHighlightGeometry} material={lastMoveMaterial} />
          </FlatOnFelt>
        )}
        {lastMove && (
          <FlatOnFelt row={lastMove.row} col={lastMove.col} y={DISC_THICKNESS + 0.012}>
            <mesh geometry={lastMoveRingGeometry} material={lastRingMaterial} scale={0.5} />
          </FlatOnFelt>
        )}

        {showInteractive &&
          showHints &&
          validMoves.map((m) => {
            const [x, z] = cellToWorld(m.row, m.col);
            return <mesh key={`h-${m.row}-${m.col}`} position={[x, 0.008, z]} geometry={hintGeometry} material={hintMaterial} />;
          })}

        {hoverIsLegal && <Ghost row={hover.row} col={hover.col} color={myColor} />}

        {focused && (
          <FlatOnFelt row={focused.row} col={focused.col} y={0.006}>
            <mesh geometry={focusRingGeometry} material={focusMaterial} />
          </FlatOnFelt>
        )}

        {discs}

        {/* Invisible hit plane for pointer picking */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, 0]}
          material={hitMaterial}
          onPointerMove={(e) => {
            e.stopPropagation();
            onHover(cellFromEvent(e));
          }}
          onPointerOut={() => onHover(null)}
          onClick={(e) => {
            e.stopPropagation();
            const cell = cellFromEvent(e);
            if (cell) onPlay(cell.row, cell.col);
          }}
        >
          <planeGeometry args={[8, 8]} />
        </mesh>
      </group>

      <ContactShadows position={[0, -0.62, 0]} opacity={0.65} scale={16} blur={2.6} far={3} resolution={512} color="#000000" />
    </>
  );
}
