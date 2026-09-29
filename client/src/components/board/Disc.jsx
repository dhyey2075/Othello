import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  DISC_REST_Y,
  bottomHalfGeometry,
  cellToWorld,
  topHalfGeometry,
} from './geometry.js';
import { DROP_DURATION, FLIP_DURATION } from '../../lib/timing.js';

const DROP_HEIGHT = 2.2;
const FLIP_LIFT = 0.55;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const WHITE_UP = new THREE.Quaternion();
const BLACK_UP = new THREE.Quaternion().setFromAxisAngle(X_AXIS, Math.PI);
const tmpQ = new THREE.Quaternion();

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Fall with gravity-like easing, then one small hop. */
function dropOffset(t) {
  if (t < 0.72) {
    const p = t / 0.72;
    return DROP_HEIGHT * (1 - p * p);
  }
  const p = (t - 0.72) / 0.28;
  return 0.11 * Math.sin(Math.PI * p);
}

export const blackMaterial = new THREE.MeshPhysicalMaterial({
  color: '#121314',
  roughness: 0.32,
  metalness: 0.05,
  clearcoat: 1,
  clearcoatRoughness: 0.18,
  side: THREE.DoubleSide,
});
export const whiteMaterial = new THREE.MeshPhysicalMaterial({
  color: '#f3f0e8',
  roughness: 0.36,
  metalness: 0,
  clearcoat: 0.8,
  clearcoatRoughness: 0.22,
  side: THREE.DoubleSide,
});

/**
 * A two-sided coin (white top half, black bottom half). Orientation is a
 * quaternion so consecutive flips around different axes compose cleanly.
 *
 * `dropIn`: animate falling onto the board (only for the disc just placed).
 * `flip`:   { delay, fromRow, fromCol } for discs flipped by the last move.
 */
export function Disc({ row, col, color, dropIn, flip, reducedMotion }) {
  const outer = useRef();
  const flipper = useRef();
  // `settled` is the orientation the disc ends up in once any running flip finishes.
  const anim = useRef({ drop: null, flip: null, lastColor: color, settled: new THREE.Quaternion() });
  const [x, z] = cellToWorld(row, col);

  useLayoutEffect(() => {
    anim.current.settled.copy(color === 'black' ? BLACK_UP : WHITE_UP);
    flipper.current.quaternion.copy(anim.current.settled);
    if (dropIn && !reducedMotion) {
      anim.current.drop = { pending: true, start: 0 };
      outer.current.position.y = DISC_REST_Y + DROP_HEIGHT;
    }
    // Orientation is only initialised on mount; later colour changes animate below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const a = anim.current;
    if (a.lastColor === color) return;
    a.lastColor = color;
    if (reducedMotion) {
      a.flip = null;
      a.settled.copy(color === 'black' ? BLACK_UP : WHITE_UP);
      flipper.current.quaternion.copy(a.settled);
      return;
    }
    // Tip the disc away from the placed disc: rotate about the horizontal axis
    // perpendicular to the direction from the placed disc.
    const axis = new THREE.Vector3(1, 0, 0);
    if (flip) {
      const dx = col - flip.fromCol;
      const dz = row - flip.fromRow;
      axis.set(dz, 0, -dx).normalize();
      if (axis.lengthSq() === 0) axis.copy(X_AXIS);
    }
    // Start from the settled orientation, not the current one: if a previous flip
    // is still mid-air, starting from its in-between pose would end on the wrong face.
    const from = a.settled.clone();
    a.settled.copy(tmpQ.setFromAxisAngle(axis, Math.PI).multiply(from));
    a.flip = { pending: true, start: 0, delay: flip?.delay ?? 0, axis, from };
  }, [color, flip, reducedMotion, row, col]);

  useFrame(({ clock }) => {
    const a = anim.current;
    const now = clock.elapsedTime;
    let y = DISC_REST_Y;

    if (a.drop) {
      if (a.drop.pending) {
        a.drop.pending = false;
        a.drop.start = now;
      }
      const t = (now - a.drop.start) / DROP_DURATION;
      if (t >= 1) a.drop = null;
      else y += dropOffset(t);
    }

    if (a.flip) {
      if (a.flip.pending) {
        a.flip.pending = false;
        a.flip.start = now + a.flip.delay;
      }
      const t = (now - a.flip.start) / FLIP_DURATION;
      if (t >= 0) {
        const e = easeInOutCubic(Math.min(1, t));
        tmpQ.setFromAxisAngle(a.flip.axis, Math.PI * e);
        flipper.current.quaternion.copy(tmpQ).multiply(a.flip.from);
        y += Math.sin(Math.PI * e) * FLIP_LIFT;
        if (t >= 1) {
          flipper.current.quaternion.copy(a.settled);
          a.flip = null;
        }
      }
    }

    outer.current.position.y = y;
  });

  return (
    <group ref={outer} position={[x, DISC_REST_Y, z]}>
      <group ref={flipper}>
        <mesh geometry={topHalfGeometry} material={whiteMaterial} castShadow receiveShadow />
        <mesh geometry={bottomHalfGeometry} material={blackMaterial} castShadow receiveShadow />
      </group>
    </group>
  );
}
