---
name: waymark-release
description: Guide for releasing Waymark npm packages. Use whenever the user mentions releasing, publishing, versioning, tagging, or creating a new version of @itsaydrian/waymark-shared, @itsaydrian/waymark-mcp-server, or any Waymark monorepo package. Also trigger when the user asks about npm publish, GitHub releases, or changelogs for these packages.
---

# Waymark Release Skill

Releases for the Waymark monorepo follow a dependency chain. Because `@itsaydrian/waymark-mcp-server` depends on `@itsaydrian/waymark-shared` via npm (not workspace symlink), shared must be published first whenever its schema or utilities change.

## Dependency Chain

```
@itsaydrian/waymark-shared     ──►  @itsaydrian/waymark-mcp-server
(schema, types, KV helpers)          (MCP tools that use shared types)
```

`apps/web` uses `workspace:*` for shared and deploys directly to Cloudflare Workers — it does **not** need an npm release.

## Release Order

1. **Release `@itsaydrian/waymark-shared`** (if it changed)
2. **Update MCP server dependency** on shared
3. **Release `@itsaydrian/waymark-mcp-server`** (if it changed or shared changed)

## Releasing `@itsaydrian/waymark-shared`

Use the release script (or follow the same steps manually):

```bash
./scripts/release-shared.sh 0.0.2
```

### Manual steps

1. **Build verification:**
   ```bash
   cd packages/shared
   rm -rf dist
   npx tsc
   ls dist/types/index.js dist/lib/index.js  # Verify outputs
   ```

2. **Update version:**
   Edit `packages/shared/package.json` — bump the version field.

3. **Update changelog:**
   Edit `packages/shared/CHANGELOG.md` — add a new section with today's date:
   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD

   ### Added / Changed / Fixed
   - Description of changes
   ```

4. **Commit:**
   ```bash
   git add packages/shared/package.json packages/shared/CHANGELOG.md
   git commit -m "chore(shared): release vX.Y.Z"
   ```

5. **Tag and push:**
   ```bash
   git tag "@itsaydrian/waymark-shared@X.Y.Z"
   git push origin "@itsaydrian/waymark-shared@X.Y.Z"
   ```

6. **GitHub release:**
   ```bash
   gh release create "@itsaydrian/waymark-shared@X.Y.Z" \
     --title "@itsaydrian/waymark-shared@X.Y.Z" \
     --notes "Release notes from CHANGELOG" \
     --repo aydrian/waymark
   ```

7. **Publish to npm:**
   ```bash
   cd packages/shared
   npm publish
   # Enter OTP from authenticator app when prompted
   ```

## Updating MCP Server Dependency

After shared is published, update the MCP server's dependency:

1. Edit `packages/mcp-server/package.json`:
   ```json
   "@itsaydrian/waymark-shared": "^X.Y.Z"
   ```

2. Run `bun install` from the repo root to update `bun.lock`.

3. Commit the lockfile change:
   ```bash
   git add packages/mcp-server/package.json bun.lock
   git commit -m "chore(mcp-server): bump shared to ^X.Y.Z"
   ```

## Releasing `@itsaydrian/waymark-mcp-server`

Use the release script (or follow manual steps):

```bash
./scripts/release-mcp-server.sh 0.1.8
```

### Manual steps

1. **Build verification (critical — must run from `packages/mcp-server/`):**
   ```bash
   cd packages/mcp-server
   rm -rf dist
   npx tsc
   ls dist/src/transports/stdio.js dist/src/transports/http.js  # Must exist
   ```

2. **Update version:**
   Edit `packages/mcp-server/package.json` — bump the version field.

3. **Update changelog:**
   Edit `packages/mcp-server/CHANGELOG.md` — add a new section with date.

4. **Commit:**
   ```bash
   git add packages/mcp-server/package.json packages/mcp-server/CHANGELOG.md
   git commit -m "chore(mcp-server): release vX.Y.Z"
   ```

5. **Tag and push:**
   ```bash
   git tag "@itsaydrian/waymark-mcp-server@X.Y.Z"
   git push origin "@itsaydrian/waymark-mcp-server@X.Y.Z"
   ```

6. **GitHub release:**
   ```bash
   gh release create "@itsaydrian/waymark-mcp-server@X.Y.Z" \
     --title "@itsaydrian/waymark-mcp-server@X.Y.Z" \
     --notes "Release notes from CHANGELOG" \
     --repo aydrian/waymark
   ```

7. **Publish to npm (requires 2FA):**
   ```bash
   cd packages/mcp-server
   npm publish
   # Enter OTP from authenticator app when prompted
   ```

## Important Notes

- **Always build from the correct directory.** For the MCP server, `npx tsc` must be run from `packages/mcp-server/`, not the repo root. Otherwise transport files are missing from the output.
- **Never skip the build verification step.** The release scripts enforce this, but if doing manual steps, always confirm `dist/` contents before publishing.
- **Shared must be published before MCP server.** External consumers of the MCP server will resolve shared from npm, not the local workspace.
- **Use `bun install` for lockfile updates.** The monorepo uses Bun workspaces; do not use `npm install`.
- **Commit messages follow Conventional Commits:** `chore(shared): release vX.Y.Z` and `chore(mcp-server): release vX.Y.Z`.
