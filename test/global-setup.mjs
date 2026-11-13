// Build dist/ once before the suite: the module tests import what a consumer imports.
import { buildAll } from "../scripts/build.mjs";
import { root } from "./helpers.mjs";

export default function setup() {
  buildAll(root);
}
