#!/usr/bin/env node
// npm run theme-assets [-- --theme <id> --slot <slot> --force]
//
// Generates each Theme asset's picture from its Prompt sheet (07 §6). This is the one file that names the
// image API: OpenAI's Images API, model gpt-image-1, chosen for PNG output with a transparent background.
// The key is read from OPENAI_API_KEY in the environment of the machine that runs it; without it the script
// prints one line and exits non-zero, changing nothing. Nothing a consumer runs, and none of the library's
// tests or builds, imports this file.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const KEY = "OPENAI_API_KEY";
const ENDPOINT = "https://api.openai.com/v1/images/generations";
const MODEL = "gpt-image-1";

const key = process.env[KEY];
if (!key) {
  process.stderr.write(`theme-assets: ${KEY} is not set in the environment; nothing was generated.\n`);
  process.exit(2);
}

let values;
try {
  ({ values } = parseArgs({
    options: { theme: { type: "string" }, slot: { type: "string" }, force: { type: "boolean", default: false } },
  }));
} catch (e) {
  process.stderr.write(`theme-assets: ${e.message}\n`);
  process.exit(2);
}

/** The one call to the image API: a prompt, a request size and a background, answered with PNG bytes. */
async function generate({ prompt, size, background }) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, size, background, output_format: "png", n: 1 }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`the image API answered ${response.status}: ${body?.error?.message ?? response.statusText}`);
  const b64 = body?.data?.[0]?.b64_json;
  if (typeof b64 !== "string") throw new Error("the image API answered without an image");
  return Buffer.from(b64, "base64");
}

const { generateAssets } = await import("./lib/assets.mjs");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const { written, failures } = await generateAssets({
    root,
    generator: { name: "openai-images", model: MODEL, generate },
    theme: values.theme,
    slot: values.slot,
    force: values.force,
    log: (line) => process.stdout.write(`add to ${line}\n`),
  });
  for (const f of failures) process.stderr.write(`theme-assets: ${f}\n`);
  process.stdout.write(`theme-assets: ${written.length} image${written.length === 1 ? "" : "s"} written, ${failures.length} failed.\n`);
  process.exit(failures.length ? 1 : 0);
} catch (e) {
  process.stderr.write(`theme-assets: ${e.message}\n`);
  process.exit(2);
}
