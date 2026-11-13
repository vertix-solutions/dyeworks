// `dyeworks/boot`: the inline script a consumer embeds in its page before its stylesheets.
import { renderBootScript, type BootOptions } from "./internal/boot-text.js";
import { themes } from "./registry.js";

export type { BootOptions };

/**
 * The inline script text, with a compact registry of every Theme embedded. It applies the stored choice (or
 * the mirror of the consumer's default) on `<html>` before the first paint and does nothing on any failure.
 */
export function bootScript(options: BootOptions): string {
  return renderBootScript(themes, options);
}
