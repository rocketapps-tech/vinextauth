/**
 * Vite config for VinextAuth docs — used by `vinext deploy` and `vinext dev`.
 * Combines fumadocs-mdx (MDX → React + TOC/frontmatter) with the vinext
 * App Router plugin and the Cloudflare Workers plugin.
 *
 * The custom dev/build scripts (scripts/dev.mjs, scripts/build.mjs) also use
 * these same plugins via createServer/createBuilder with configFile: false.
 */
import { defineConfig } from 'vite';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';
import fumamdx from 'fumadocs-mdx/vite';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));

const fumaPlugin = await fumamdx(
  {},
  {
    configPath: path.join(root, 'source.config.ts'),
    outDir: path.join(root, '.source'),
  }
);

export default defineConfig({
  plugins: [
    fumaPlugin,
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
  resolve: {
    alias: {
      'next/navigation.js': path.join(root, 'node_modules/vinext/dist/shims/navigation.js'),
      'next/link.js': path.join(root, 'node_modules/vinext/dist/shims/link.js'),
      'next/image.js': path.join(root, 'node_modules/vinext/dist/shims/image.js'),
    },
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'fumadocs-core',
      'fumadocs-ui',
    ],
  },
  ssr: {
    noExternal: ['fumadocs-mdx', 'fumadocs-core', 'fumadocs-ui'],
  },
});
