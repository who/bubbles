# bubbles

A new project

## Development Workflow (ortus grind)

This project's work is chunked through the global [Ortus](https://github.com/who/ortus) CLI. Install the `ortus` binary, then run `ortus grind .` from the project root to drain the `bd ready` issue queue to zero:

```bash
ortus grind .            # drain bd ready to zero, one issue per iteration
ortus grind . --tasks 1  # close exactly one issue, then stop
ortus tail               # follow the most recent grind logs
```

Each iteration spawns a fresh `claude -p /goal` subprocess with a narrow per-task condition — close exactly one issue — and the outer loop trusts only observable `bd` state to decide success, orphan-claim recovery, and retry. Because `bd ready` *is* the queue, an issue must be in ready state (no open blockers) before it can be picked up. See [AGENTS.md](AGENTS.md) for the full command surface.

## Tech Stack

- **Language**: Typescript
- **Package Manager**: npm
- **Linter**: eslint
- **License**: MIT

## Requirements

- **[beads](https://github.com/steveyegge/beads) v1.0.0+** — issue tracking, backed by an embedded (in-process) Dolt engine (see `.beads/metadata.json`). The git-tracked `.beads/issues.jsonl` is the source of truth; run `bd bootstrap` to rebuild the Dolt store from it.
- **[dolt](https://docs.dolthub.com/introduction/installation)** — the storage engine beads embeds. Must be on `PATH`.
- **[claude](https://github.com/anthropics/claude-code)** — Claude CLI, invoked by `ortus grind` for each task.
- **[jq](https://jqlang.github.io/jq/)**, **[rg](https://github.com/BurntSushi/ripgrep)**, **[fd](https://github.com/sharkdp/fd)** — used by the ortus CLI and bd.

**Optional: [CodeGraph](https://github.com/colbymchenry/codegraph).** Code exploration runs faster when CodeGraph is installed — it provides a pre-indexed semantic graph of the codebase, so symbols, callers, and call graphs resolve in one MCP call instead of dozens of grep/glob/Read calls. **Not required.** CodeGraph is detected at runtime: if `.codegraph/` exists and the MCP server is reachable it is used; otherwise tooling falls back silently to the default search behavior.

## Sandboxing

`ortus grind` runs Claude Code inside the OS sandbox so that bash subprocesses spawned during a task are confined to filesystem-write and network boundaries. The native sandbox is the actual containment surface; `--dangerously-skip-permissions` only suppresses interactive prompts and does not reduce containment. Install the OS prerequisites below before running `ortus grind`:

- **macOS**: Seatbelt is built into the OS — no install required.
- **Linux / WSL2**: install bubblewrap and socat via `sudo apt-get install bubblewrap socat` (or your distro's equivalent).
- **WSL1**: unsupported — the sandbox requires WSL2's Linux kernel.

For stronger isolation on hosts where the native sandbox is insufficient, the ortus CLI supports an outer Docker layer around the native inner sandbox; see the [ortus](https://github.com/who/ortus) docs for details.

## Privacy verification

Per PRD §8.4, file contents must never leave the browser. The repo enforces this in two layers:

**Static (CI):** `.eslintrc.cjs` adds an override scoped to `src/parsing/**` and `src/pnl/**` that bans `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, and `window.fetch` via `no-restricted-globals` / `no-restricted-properties`. Tests and `__fixtures__` are excluded (not shipped to users). `npm run lint` fails if any of these appear in production parsing/engine code.

**Manual (per release):**

1. `npm run build && npx serve dist`
2. Open Chrome DevTools → Network tab; clear log; check "Preserve log".
3. Drop a real Robinhood export onto the dropzone.
4. Confirm zero requests fire whose payload contains file content. The only requests should be the static asset loads (HTML, JS, CSS) served from the local origin.

**Smoke-testing the lint rule locally:**

```bash
# Should fail with no-restricted-globals on `fetch`
printf 'fetch("/x");\n' >> src/parsing/parseCsv.ts
npm run lint   # expect non-zero exit
git checkout -- src/parsing/parseCsv.ts
npm run lint   # expect zero exit (rule lifted once the offender is gone)
```

## Deployment

`npm run build` emits `dist/` — a self-contained static bundle (`index.html`, hashed JS/CSS in `dist/assets/`, plus `public/` passthroughs). The build reads no environment variables, so the same `dist/` deploys identically across hosts. Local smoke-test:

```bash
npm run build
npx serve dist   # default http://localhost:3000
```

Three host options:

**Vercel** — `vercel --prod` from the project root; Vercel auto-detects the Vite preset and uses `npm run build` / `dist`. No `vercel.json` required for an SPA with a single index entry.

**Netlify** — `netlify deploy --prod --dir=dist` after `npm run build`, or wire continuous deploys with a minimal `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

**S3 + CloudFront** —

```bash
aws s3 sync dist s3://your-bucket --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths '/*'
```

Set the CloudFront distribution's default root object to `index.html`. No SPA-routing fallback is needed — the app uses no client-side router; every direct path either is `/` or 404s the same way it would on any host.
