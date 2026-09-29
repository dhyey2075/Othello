import { useRef } from 'react';

/**
 * Returns the most recent non-null value. Screens keep rendering their last
 * snapshot while they animate out after the game state has been cleared.
 */
export function useLatestDefined(value) {
  const ref = useRef(value);
  if (value != null) ref.current = value;
  return ref.current;
}
