# Add Session Adapter

Add a new session storage adapter to vinextauth.

## Steps

1. **Read the existing adapter** to understand the interface:
   - `src/adapters/cloudflare-kv.ts`
   - `src/types.ts` — look for the `SessionAdapter` interface

2. **Create** `src/adapters/$ARGUMENTS.ts`:
   - Export a default function `NameAdapter(options): SessionAdapter`
   - Implement all required `SessionAdapter` methods: `getSession`, `setSession`, `deleteSession`
   - Use only Web Crypto / platform APIs — no Node.js dependencies

3. **Register the export** in `tsup.config.ts` under `entry`:
   ```ts
   "src/adapters/$ARGUMENTS": "src/adapters/$ARGUMENTS.ts"
   ```

4. **Register the export** in `package.json` under `exports`:
   ```json
   "./adapters/$ARGUMENTS": {
     "types": "./dist/adapters/$ARGUMENTS.d.ts",
     "import": "./dist/adapters/$ARGUMENTS.js"
   }
   ```

5. Run `npm run typecheck` to verify types.
6. Add integration tests if the adapter can be tested without the actual service (use mock bindings).
