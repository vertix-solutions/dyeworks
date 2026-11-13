import { useCallback, useSyncExternalStore } from "react";
import type { Chooser } from "../chooser.js";

/** Re-render on every change the chooser announces; returns a key that changes with the choice. */
export function useChooser(chooser: Chooser): string {
  const subscribe = useCallback((fn: () => void) => chooser.subscribe(fn), [chooser]);
  const snapshot = () => {
    const s = chooser.get();
    const r = chooser.resolved();
    return `${s.theme}|${s.scheme}|${s.intensity}|${r.scheme}`;
  };
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
