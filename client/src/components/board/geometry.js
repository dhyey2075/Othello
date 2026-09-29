import * as THREE from 'three';

export const DISC_RADIUS = 0.41;
export const DISC_THICKNESS = 0.15;
/** Height of a resting disc's centre above the felt. */
export const DISC_REST_Y = DISC_THICKNESS / 2 + 0.005;

/** World position of a cell centre; row 0 is the far edge, col 0 the left edge. */
export function cellToWorld(row, col) {
  return [col - 3.5, row - 3.5];
}

/**
 * One half of a coin as a lathe: flat face with a rounded bevel down to the
 * seam at y = 0. `sign` = 1 builds the top half, -1 the bottom half.
 */
function coinHalf(sign) {
  const r = DISC_RADIUS;
  const h = DISC_THICKNESS / 2;
  const b = 0.05;
  const profile = [
    [0.0001, h],
    [r - b, h],
    [r - b * 0.45, h - b * 0.1],
    [r - b * 0.12, h - b * 0.45],
    [r, h - b],
    [r, 0],
  ].map(([x, y]) => new THREE.Vector2(x, y * sign));
  const geo = new THREE.LatheGeometry(profile, 56);
  geo.computeVertexNormals();
  return geo;
}

export const topHalfGeometry = coinHalf(1);
export const bottomHalfGeometry = coinHalf(-1);
export const ghostGeometry = new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, DISC_THICKNESS * 0.6, 48);
export const hintGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24);
export const cellHighlightGeometry = new THREE.PlaneGeometry(0.96, 0.96);
// A 4-segment ring rotated 45° is a square outline.
export const focusRingGeometry = new THREE.RingGeometry(0.62, 0.68, 4, 1, Math.PI / 4);
export const lastMoveRingGeometry = new THREE.RingGeometry(0.44, 0.48, 48);
