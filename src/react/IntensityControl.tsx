import type { Chooser } from "../chooser.js";
import { useChooser } from "./useChooser.js";

/**
 * A native range from 0 to 1 in steps of 0.05, labelled "Intensity", rendered only while the resolved Theme
 * declares `intensity: true`. Carries no style of its own.
 */
export function IntensityControl({ chooser }: { chooser: Chooser }) {
  useChooser(chooser);
  const resolved = chooser.resolved();
  const theme = chooser.registry.themes.find((t) => t.id === resolved.theme);
  if (!theme?.intensity) return null;
  return (
    <label>
      Intensity{" "}
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={String(resolved.intensity)}
        onChange={(e) => chooser.set({ intensity: Number(e.currentTarget.value) })}
      />
    </label>
  );
}
