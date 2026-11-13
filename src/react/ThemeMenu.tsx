import type { Chooser } from "../chooser.js";
import { useChooser } from "./useChooser.js";

const SEP = ":";

/** A native `<select>` labelled "Theme" over the registry's menu options. Carries no style of its own. */
export function ThemeMenu({ chooser }: { chooser: Chooser }) {
  useChooser(chooser);
  const options = chooser.registry.options();
  const stored = chooser.get();
  const theme = chooser.registry.themes.find((t) => t.id === stored.theme);
  const scheme = theme && theme.schemes.length === 1 ? theme.schemes[0] : stored.scheme;
  return (
    <label>
      Theme{" "}
      <select
        value={`${stored.theme}${SEP}${scheme}`}
        onChange={(e) => {
          const [id, chosen] = e.currentTarget.value.split(SEP);
          chooser.set({ theme: id, scheme: chosen as "auto" | "light" | "dark" });
        }}
      >
        {options.map((o) => (
          <option key={`${o.theme}${SEP}${o.scheme}`} value={`${o.theme}${SEP}${o.scheme}`}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
