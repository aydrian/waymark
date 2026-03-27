# Bun Package Manager

Always use **bun** as the package manager. Never use npm, yarn, or pnpm.

- Install dependencies: `bun install`
- Add a package: `bun add <package>`
- Add a dev dependency: `bun add -d <package>`
- Remove a package: `bun remove <package>`
- Run scripts: `bun run <script>`
- Execute binaries: `bunx <binary>`

Never create or commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. The lockfile is `bun.lock`.
