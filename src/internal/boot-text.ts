// The boot script's text for a given set of Themes; `dyeworks/boot` binds it to the generated registry.
import { applyResolution, resolveChoice, type CompactTheme } from "./resolve.js";

export interface BootOptions {
  storageKey: string;
  mirrorKey?: string;
}

/** A JSON literal safe inside an inline `<script>`: no `<` survives to close the element. */
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const literal = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c").split(LS).join("\\u2028").split(PS).join("\\u2029");

/** Only what resolution reads: id, Schemes and assets, in registry order. */
export function compact(themes: CompactTheme[]): CompactTheme[] {
  return themes.map((t) => ({ id: t.id, schemes: t.schemes, assets: t.assets }));
}

/**
 * The inline script: reads the storage key (or the mirror when it holds nothing), resolves, and writes the
 * attributes and properties on `<html>`. Every failure is caught; on one, nothing is written.
 */
export function renderBootScript(themes: CompactTheme[], { storageKey, mirrorKey }: BootOptions): string {
  return (
    "(function(){try{" +
    `var T=${literal(compact(themes))},K=${literal(storageKey)},M=${literal(mirrorKey ?? null)};` +
    "var s=localStorage,raw=s.getItem(K);if(raw===null&&M!==null)raw=s.getItem(M);" +
    'var d=false;try{d=!!matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}' +
    `var r=(${resolveChoice.toString()})(T,raw,d);` +
    `(${applyResolution.toString()})(document.documentElement,r);` +
    "}catch(e){}})();"
  );
}
