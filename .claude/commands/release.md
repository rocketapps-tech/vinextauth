# Release

Prepare and publish a new version of vinextauth.

## Steps

1. **Check the current state:**
   ```bash
   git status
   git log --oneline -10
   npm run test
   npm run typecheck
   ```

2. **Determine the version bump** based on changes since last tag:
   - `patch` — bug fixes, security patches (e.g. 0.3.3 → 0.3.4)
   - `minor` — new features, new providers/adapters (e.g. 0.3.x → 0.4.0)
   - `major` — breaking changes to public API or JWT format (e.g. 0.x → 1.0.0)

3. **Update version** in `package.json`.

4. **Build:**
   ```bash
   npm run build
   ```

5. **Commit and tag:**
   ```bash
   git add package.json
   git commit -m "chore: bump version to X.Y.Z"
   git tag vX.Y.Z
   ```

6. **Publish to npm:**
   ```bash
   npm publish --access public
   ```

7. **Push:**
   ```bash
   git push && git push --tags
   ```

## Important Notes

- JWT format changes are **breaking** — always major version
- Never publish with `dist/` from a dirty working tree
- Run `npm run test` and `npm run typecheck` before every release
