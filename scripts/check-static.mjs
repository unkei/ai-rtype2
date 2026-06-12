import { readFile } from "node:fs/promises";

const files = {
  html: await readFile("index.html", "utf8"),
  css: await readFile("styles.css", "utf8"),
  js: await readFile("src/game.js", "utf8")
};

const requiredHtml = [
  '<canvas id="game"',
  'id="touchFire"',
  'id="touchCharge"',
  'id="stick"',
  'src="src/game.js"'
];

const requiredJs = [
  "navigator.getGamepads",
  "gamepadconnected",
  "pointerdown",
  "touchCharge",
  "requestAnimationFrame",
  "function fireBeam"
];

for (const token of requiredHtml) {
  if (!files.html.includes(token)) throw new Error(`index.html is missing ${token}`);
}

for (const token of requiredJs) {
  if (!files.js.includes(token)) throw new Error(`src/game.js is missing ${token}`);
}

if (!files.css.includes("@media (hover: none)") || !files.css.includes("touch-action: none")) {
  throw new Error("styles.css is missing touch-oriented responsive rules");
}

console.log("Static checks passed");
