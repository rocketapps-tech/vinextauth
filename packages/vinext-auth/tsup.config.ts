import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "react/index": "src/react/index.ts",
    "server/index": "src/server/index.ts",
    "middleware/index": "src/middleware/index.ts",
    "providers/google": "src/providers/google.ts",
    "providers/github": "src/providers/github.ts",
    "providers/credentials": "src/providers/credentials.ts",
    "adapters/cloudflare-kv": "src/adapters/cloudflare-kv.ts",
  },
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  treeshake: true,
  target: "es2022",
});
