// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { createChooser } from "../dist/chooser.js";
import { IntensityControl, ThemeMenu } from "../dist/react/index.js";
import { fakeMatchMedia, memoryStorage, registry } from "./fixtures.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
let container;
let chooser;

function mount(element) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(element));
}

function setup(stored) {
  vi.stubGlobal("localStorage", memoryStorage(stored ? { k: JSON.stringify(stored) } : {}));
  vi.stubGlobal("matchMedia", fakeMatchMedia(false));
  chooser = createChooser({ storageKey: "k", registry });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  chooser?.destroy();
  vi.unstubAllGlobals();
});

function change(element, value) {
  const proto = Object.getPrototypeOf(element);
  Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

test("ThemeMenu is a native <select> labelled Theme over the registry's options", () => {
  setup({ theme: "dunes", scheme: "dark" });
  mount(createElement(ThemeMenu, { chooser }));
  const select = container.querySelector("select");
  expect(select.labels[0].textContent).toContain("Theme");
  expect([...select.options].map((o) => o.textContent)).toEqual(registry.options().map((o) => o.label));
  expect(select.options[select.selectedIndex].textContent).toBe("Dunes · dark");
  expect(container.querySelector("[style]")).toBeNull();
  expect(container.querySelector("[class]")).toBeNull();
});

test("choosing an option sets the Theme and Scheme on the chooser", () => {
  setup();
  mount(createElement(ThemeMenu, { chooser }));
  const select = container.querySelector("select");
  expect(select.options[select.selectedIndex].textContent).toBe("Default · auto");
  act(() => change(select, select.options[[...select.options].findIndex((o) => o.textContent === "Night")].value));
  expect(chooser.get()).toMatchObject({ theme: "night", scheme: "dark" });
  expect(document.documentElement.getAttribute("data-theme")).toBe("night");
});

test("ThemeMenu follows a change made elsewhere", () => {
  setup();
  mount(createElement(ThemeMenu, { chooser }));
  act(() => chooser.set({ theme: "dunes", scheme: "light" }));
  const select = container.querySelector("select");
  expect(select.options[select.selectedIndex].textContent).toBe("Dunes · light");
});

test("IntensityControl is a native range 0 to 1 step 0.05 labelled Intensity, only under an intensity Theme", () => {
  setup({ theme: "default" });
  mount(createElement(IntensityControl, { chooser }));
  expect(container.querySelector("input")).toBeNull();
  act(() => chooser.set({ theme: "dunes", intensity: 0.35 }));
  const input = container.querySelector("input");
  expect(input.type).toBe("range");
  expect([input.min, input.max, input.step, input.value]).toEqual(["0", "1", "0.05", "0.35"]);
  expect(input.labels[0].textContent).toContain("Intensity");
  act(() => change(input, "0.8"));
  expect(chooser.get().intensity).toBe(0.8);
  expect(document.documentElement.style.getPropertyValue("--intensity")).toBe("0.8");
  act(() => chooser.set({ theme: "default" }));
  expect(container.querySelector("input")).toBeNull();
});
