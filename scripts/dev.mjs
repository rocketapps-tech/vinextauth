/**
 * Custom dev server for VinextAuth docs.
 * Combines the vinext Vite plugin with fumadocs-mdx/vite so that
 * .mdx?collection=docs imports are handled correctly.
 *
 * This is the "fumadocs-for-vinext" integration layer.
 */
import { createServer } from "vite";
import vinext from "vinext";
import fumamdx from "fumadocs-mdx/vite";
import { fileURLToPath } from "url";
import path from "path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

// fumadocs-mdx Vite plugin: handles .mdx?collection=* transforms + .source/ generation
const fumaPlugin = await fumamdx({}, {
  configPath: path.join(appRoot, "source.config.ts"),
  outDir: path.join(appRoot, ".source"),
});

const PORT = parseInt(process.env.PORT ?? "3003", 10);

const server = await createServer({
  root: appRoot,
  configFile: false,
  plugins: [
    fumaPlugin,   // enforce: "pre" — handles .mdx transforms before vinext sees them
    vinext(),     // handles RSC, SSR, routing, pages
  ],
  resolve: {
    alias: {
      "collections/server": path.join(appRoot, ".source/server.ts"),
      "collections/browser": path.join(appRoot, ".source/browser.ts"),
      // fumadocs-core imports next/* with .js extension — vinext only aliases without .js
      "next/navigation.js": path.join(appRoot, "node_modules/vinext/dist/shims/navigation.js"),
      "next/link.js": path.join(appRoot, "node_modules/vinext/dist/shims/link.js"),
      "next/image.js": path.join(appRoot, "node_modules/vinext/dist/shims/image.js"),
    },
    dedupe: [
      "react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime",
      "fumadocs-core", "fumadocs-ui",
    ],
  },
  ssr: {
    noExternal: ["fumadocs-mdx", "fumadocs-core", "fumadocs-ui"],
  },
  // Pre-bundle lucide-react and next-themes to avoid slow first load
  optimizeDeps: {
    include: [
      "next-themes",
      "lucide-react",
    ],
  },
});

await server.listen(PORT);
server.printUrls();
