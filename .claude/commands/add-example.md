# Add Example App

Add a new example to `apps/examples/` demonstrating a specific vinextauth feature or framework integration.

## Usage

`/add-example <framework>-<feature>`

Examples: `vinext-with-kv`, `vinext-credentials`, `vinext-multi-tenant`

## Steps

1. **Create the directory** `apps/examples/$ARGUMENTS/`

2. **Required files:**
   - `package.json` — name `@vinextauth/example-$ARGUMENTS`, `"vinextauth": "*"` in deps
   - `tsconfig.json` — copy from `apps/examples/vinext-basic/tsconfig.json`
   - `next.config.ts` — include `transpilePackages: ["vinextauth"]`
   - `.env.example` — document all required env vars with setup instructions
   - `src/auth.ts` — VinextAuth config showcasing the specific feature
   - `src/middleware.ts`
   - `src/app/api/auth/[...vinextauth]/route.ts`
   - `src/app/layout.tsx` — with SessionProvider
   - `src/app/page.tsx` — demonstrates the feature clearly

3. **Use a unique port** (3003, 3004, etc.) in `package.json` scripts to avoid conflicts with other apps.

4. **Register a root script** in the root `package.json`:
   ```json
   "dev:example-$ARGUMENTS": "npm run dev --workspace=apps/examples/$ARGUMENTS"
   ```

5. **Keep examples clean and commented** — they serve as documentation for end users.
