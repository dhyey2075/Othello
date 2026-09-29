/** Small 2D disc used in the UI chrome (player cards, buttons). */
export function DiscIcon({ color, size = 16, className = '' }) {
  const black = color === 'black';
  const random = color === 'random';
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: random
          ? 'linear-gradient(90deg, #141414 50%, #f1efe9 50%)'
          : black
            ? 'radial-gradient(circle at 35% 30%, #4a4d52, #121314 60%)'
            : 'radial-gradient(circle at 35% 30%, #ffffff, #d9d5ca 70%)',
        boxShadow: `inset 0 -2px 0 ${black || random ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.18)'}, 0 2px 6px rgba(0,0,0,0.45)`,
      }}
    />
  );
}
