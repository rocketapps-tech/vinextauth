# Add OAuth Provider

Add a new OAuth provider to vinextauth.

## Steps

1. **Read the existing providers** to understand the pattern:
   - `src/providers/google.ts`
   - `src/providers/github.ts`

2. **Create** `src/providers/$ARGUMENTS.ts` following the same structure:
   - Export a default function `ProviderName(options): OAuthProvider`
   - Include `id`, `name`, `type: "oauth"`, `authorization`, `token`, `userinfo` endpoints
   - Map the userinfo response to `{ id, name, email, image }`

3. **Register the export** in `tsup.config.ts` under `entry`:
   ```ts
   "src/providers/$ARGUMENTS": "src/providers/$ARGUMENTS.ts"
   ```

4. **Register the export** in `package.json` under `exports`:
   ```json
   "./providers/$ARGUMENTS": {
     "types": "./dist/providers/$ARGUMENTS.d.ts",
     "import": "./dist/providers/$ARGUMENTS.js"
   }
   ```

5. **Add a usage example** in the dev app `apps/dev/vinext/src/auth.ts`.

6. Run `npm run typecheck` to verify types.
