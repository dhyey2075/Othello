import * as THREE from 'three';

/**
 * Procedurally paints the felt surface (colour gradient, fibre noise, grid and
 * star points) into a canvas so no image assets are needed.
 */
export function createFeltTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');

  const grad = g.createRadialGradient(size / 2, size * 0.42, size * 0.05, size / 2, size / 2, size * 0.78);
  grad.addColorStop(0, '#236a4f');
  grad.addColorStop(0.6, '#1a5540');
  grad.addColorStop(1, '#10392b');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  // Fibre noise: per-pixel jitter plus a few longer streaks.
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.05;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1;
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = Math.random() * Math.PI;
    const l = 4 + Math.random() * 10;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  g.globalAlpha = 1;

  const cell = size / 8;
  const line = Math.max(2, size * 0.0035);

  // Grid: a dark groove with a faint light edge reads as a slight emboss.
  for (let i = 0; i <= 8; i++) {
    const p = Math.round(i * cell);
    const w = i === 0 || i === 8 ? line * 2.2 : line;
    g.fillStyle = 'rgba(6, 22, 16, 0.78)';
    g.fillRect(p - w / 2, 0, w, size);
    g.fillRect(0, p - w / 2, size, w);
    g.fillStyle = 'rgba(255, 255, 255, 0.05)';
    g.fillRect(p + w / 2, 0, 1, size);
    g.fillRect(0, p + w / 2, size, 1);
  }

  g.fillStyle = 'rgba(6, 22, 16, 0.85)';
  for (const [x, y] of [[2, 2], [2, 6], [6, 2], [6, 6]]) {
    g.beginPath();
    g.arc(x * cell, y * cell, size * 0.008, 0, Math.PI * 2);
    g.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
