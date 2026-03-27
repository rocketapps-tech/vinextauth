/**
 * Custom build script for VinextAuth docs.
 * Combines the vinext Vite plugin with fumadocs-mdx/vite.
 *
 * Uses createBuilder (Vite 6+ multi-environment build) so that
 * @vitejs/plugin-rsc can build rsc → ssr → client in the correct order.
 */
import { createBuilder } from "vite";
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

const builder = await createBuilder({
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
  ssr: {
    noExternal: ["fumadocs-mdx", "fumadocs-core", "fumadocs-ui"],
  },
});

await builder.buildApp();
