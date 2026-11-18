import { useSyncExternalStore } from 'react';
import { player } from '../lib/player';
import type { PlayerState } from '../lib/types';

/**
 * Subscribe to a slice of player state. Selectors should return primitives or
 * stable references (arrays from the store) so React can skip re-renders.
 */
export function usePlayerValue<T>(selector: (state: PlayerState) => T): T {
  return useSyncExternalStore(player.subscribe, () => selector(player.getSnapshot()));
}
