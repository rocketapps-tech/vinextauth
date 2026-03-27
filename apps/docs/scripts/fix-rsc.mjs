/**
 * Ensures @vitejs/plugin-rsc is resolved from the local app's node_modules
 * (which uses Vite 8) rather than the root node_modules (which has Vite 5
 * hoisted there by vitest). Must run after every `npm install`.
 */
import { cpSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "../..");

const src = path.join(repoRoot, "node_modules/@vitejs/plugin-rsc");
const dest = path.join(appRoot, "node_modules/@vitejs/plugin-rsc");

if (!existsSync(src)) {
  console.warn("[fix-rsc] source not found at", src);
  process.exit(0);
}

cpSync(src, dest, { recursive: true });
console.log("[fix-rsc] @vitejs/plugin-rsc copied to local node_modules");
