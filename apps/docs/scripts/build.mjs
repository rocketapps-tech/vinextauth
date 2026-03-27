/**
 * Custom build script for VinextAuth docs.
 * Combines the vinext Vite plugin with fumadocs-mdx/vite.
 */
import { build } from "vite";
import vinext from "vinext";
import fumamdx from "fumadocs-mdx/vite";
import { fileURLToPath } from "url";
import path from "path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

const fumaPlugin = await fumamdx({}, {
  configPath: path.join(appRoot, "source.config.ts"),
  outDir: path.join(appRoot, ".source"),
});

await build({
  root: appRoot,
  configFile: false,
  plugins: [
    fumaPlugin,
    vinext(),
  ],
  resolve: {
    alias: {
      "next/navigation.js": path.join(appRoot, "node_modules/vinext/dist/shims/navigation.js"),
      "next/link.js": path.join(appRoot, "node_modules/vinext/dist/shims/link.js"),
      "next/image.js": path.join(appRoot, "node_modules/vinext/dist/shims/image.js"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "fumadocs-core",
      "fumadocs-ui",
    ],
  },
});
