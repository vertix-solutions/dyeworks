// The demo page: every Slot kind over every Theme and Scheme, read from the generated registry.
// The URL carries the choice (?theme=<id>&scheme=auto|light|dark&intensity=<0..1>) so screenshots can set it.
import { themes } from "/dist/registry.js";

const html = document.documentElement;
const params = new URLSearchParams(location.search);
const dark = matchMedia("(prefers-color-scheme: dark)");
const state = {
  theme: themes.some((t) => t.id === params.get("theme")) ? params.get("theme") : "default",
  scheme: ["auto", "light", "dark"].includes(params.get("scheme")) ? params.get("scheme") : "auto",
  intensity: clamp(Number.parseFloat(params.get("intensity") ?? "0.5")),
};

function clamp(n) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
}

const current = () => themes.find((t) => t.id === state.theme);

function resolvedScheme(theme) {
  if (theme.schemes.length === 1) return theme.schemes[0];
  if (state.scheme === "auto") return dark.matches ? "dark" : "light";
  return state.scheme;
}

function assetUrl(theme, slot, scheme) {
  const declared = theme.assets[slot];
  if (!declared) return "none";
  const entry = "fallback" in declared ? declared : declared[scheme];
  return `url(/themes/${theme.id}/${entry.image ?? entry.fallback})`;
}

function apply() {
  const theme = current();
  const scheme = resolvedScheme(theme);
  html.dataset.theme = theme.id;
  html.dataset.scheme = scheme;
  html.style.setProperty("--intensity", String(state.intensity));
  for (const slot of ["backdrop", "ornament", "empty"]) html.style.setProperty(`--asset-${slot}`, assetUrl(theme, slot, scheme));
  renderControls(theme, scheme);
  history.replaceState(null, "", `?theme=${theme.id}&scheme=${state.scheme}&intensity=${state.intensity}`);
}

const themeSelect = document.getElementById("theme");
const schemeSelect = document.getElementById("scheme");
const intensityInput = document.getElementById("intensity");
const intensityValue = document.getElementById("intensity-value");

function option(value, label, selected) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  o.selected = selected;
  return o;
}

function renderControls(theme, scheme) {
  themeSelect.replaceChildren(...themes.map((t) => option(t.id, t.label, t.id === theme.id)));
  const schemes = theme.schemes.length === 1 ? theme.schemes : ["auto", ...theme.schemes];
  schemeSelect.replaceChildren(...schemes.map((s) => option(s, s === "auto" ? `auto (${scheme})` : s, theme.schemes.length === 1 || s === state.scheme)));
  schemeSelect.disabled = theme.schemes.length === 1;
  intensityInput.value = String(state.intensity);
  intensityInput.disabled = !theme.intensity;
  intensityValue.textContent = theme.intensity ? state.intensity.toFixed(2) : "not used";
  document.getElementById("lede").textContent =
    `${theme.label} · ${scheme}. Every Slot kind is rendered below with dyeworks' slots.css; ` +
    (theme.intensity ? `decoration follows Intensity ${state.intensity.toFixed(2)}.` : "this Theme's decoration is inert, so the Slots show the plain treatment.");
}

themeSelect.addEventListener("change", () => ((state.theme = themeSelect.value), apply()));
schemeSelect.addEventListener("change", () => ((state.scheme = schemeSelect.value), apply()));
intensityInput.addEventListener("input", () => ((state.intensity = clamp(Number.parseFloat(intensityInput.value))), apply()));
dark.addEventListener("change", () => state.scheme === "auto" && apply());

async function renderTokens() {
  const contract = await (await fetch("/tokens.json")).json();
  const colours = contract.tokens.filter((t) => t.type === "color");
  const texts = ["--fg", "--muted", "--accent", "--danger", ...colours.map((t) => t.name).filter((n) => /^--(series|state)-/.test(n))];
  const pairs = document.getElementById("pairs");
  pairs.replaceChildren(
    ...["--bg", "--bg-raised"].map((surface) => {
      const box = document.createElement("div");
      box.className = "pair";
      box.style.background = `var(${surface})`;
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = `text and data Tokens on ${surface}`;
      box.append(label, ...texts.map((name) => Object.assign(document.createElement("span"), { textContent: name.slice(2), style: `color: var(${name})` })));
      return box;
    }),
    Object.assign(document.createElement("div"), { className: "notice", textContent: "A warning notice: --warning-fg on --warning-bg." }),
    Object.assign(document.createElement("div"), { className: "pair", style: "background: var(--selected)", textContent: "--fg on --selected" }),
  );
  document.getElementById("swatches").replaceChildren(
    ...colours.map((t) => {
      const cell = document.createElement("div");
      cell.className = "swatch";
      cell.title = t.meaning;
      cell.innerHTML = `<div class="chip" style="background: var(${t.name})"></div><div class="name">${t.name}</div>`;
      return cell;
    }),
  );
  document.body.dataset.ready = "true";
}

apply();
renderTokens();
