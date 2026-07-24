# Instructions for Claude

Auto-loaded at the start of every session in this repo.

## What this app is

Local web app that manages Claude CLI sessions: reads the `*.jsonl` files `claude` writes to
`~/.claude/projects`, lists them, and can resume one (`claude --resume <id>`) in a new terminal
window. Monorepo (Yarn workspaces): root = React/Vite/Tailwind frontend, `server/` = Express
backend. See `README.md` for setup/run instructions.

**Primary support: Linux.** Windows/macOS have code paths but are not smoke-tested on real
hardware — see "Cross-platform caveats" below.

## Stack & layout

Read this before exploring the repo — it's meant to save a round of `package.json`/directory
spelunking at the start of a task.

- **Package manager**: Yarn 4 (Berry) via Corepack, workspaces = root + `server/`. Always
  `yarn <script>` / `yarn workspace server run <script>`, never `npm`.
- **Frontend** (root workspace): React 19 + TypeScript, built with Vite 8
  (`@vitejs/plugin-react`). Tailwind CSS v4 via the `@tailwindcss/vite` plugin (no `tailwind.config`
  file — v4 is CSS-first, config lives in `src/index.css`). Radix UI (`@radix-ui/react-tooltip`)
  for the tooltip primitive, `lucide-react` for icons, `axios` for API calls. Dev server on
  **port 58230**, proxies `/sessions` and `/system` to the backend (`vite.config.ts`).
- **Backend** (`server/`): Express 5 + TypeScript. Dev via `tsx watch index.ts` (no build step
  needed locally); prod build is plain `tsc`. Listens on **port 58231**
  (`server/index.ts`, `PORT` env override).
- **TypeScript**: project-references setup — root `tsconfig.json` references
  `tsconfig.app.json` (src) and `tsconfig.node.json` (vite config); `server/tsconfig.json` is
  separate/standalone. `yarn typecheck` = `tsc -b --noEmit` at the root.
- **Lint/format**: ESLint 10 flat config (`eslint.config.js` at root, separate one in `server/`),
  `typescript-eslint` with type-checked rules, `eslint-plugin-react-hooks` +
  `eslint-plugin-react-refresh` for the frontend. Prettier 3 (see `.prettierrc.json`: double-quote
  style off i.e. double quotes, semicolons, 100 print width). Husky pre-commit hook runs
  `lint-staged` (ESLint only, on staged `.ts`/`.tsx`). `yarn lint` also runs
  `scripts/check-terminal-launchers-sync.mjs` (see below).
- **No test suite** — nothing runs under `yarn test` in this repo; verification is
  `yarn typecheck` + `yarn lint` + manual exercise via `yarn dev`.
- **Data sources on disk** (no database): `~/.claude/projects/*.jsonl` (session transcripts, read
  by `server/utils/claudeProjects.ts`), `~/.claude-session-manager/custom-titles.json` (this app's
  nickname sidecar, `server/utils/nicknames.ts`), `~/.claude/sessions/<pid>.json` (CLI's own active-
  session state, read by `getActiveResumeSessionIds()` in `sessionService.ts`).
- **Layout**:
  - `src/components/` — presentational + modal components (`SessionCard`, `PromptPreviewModal`,
    `UsageDetailsModal`, `Header`, etc.)
  - `src/hooks/` — `useSessions`, `useTheme`, `useToast`, `useUpdate`, `useUrlState`
  - `src/pages/SessionsPage.tsx` — the single page/route
  - `src/services/` — `sessionsApi.ts` / `systemApi.ts`, thin axios wrappers around the backend
  - `server/routes/` — `sessions.ts`, `system.ts` (Express routers, thin — error mapping only)
  - `server/services/` — `sessionService.ts` (core logic: list/delete/continue/nickname sessions,
    active-session detection), `updateService.ts` (self-update via git pull)
  - `server/utils/` — `claudeProjects.ts` (JSONL parsing), `nicknames.ts` (sidecar file),
    `pricing.ts` (token cost table)
- **API surface** (see README.md for the full table): `GET /sessions`, `GET
  /sessions/:id/prompts`, `PATCH /sessions/:id/nickname`, `DELETE /sessions/:id`, `POST
  /sessions/:id/continue`, plus `/system/update*` routes for the self-update feature.
- **Session data model** — `src/types/session.ts` and `server/types/session.ts` define the *same*
  `Session` type independently (no shared package between the two workspaces) — a shape change
  needs both files edited, there's nothing that enforces they match:
  ```ts
  type Session = {
    id: string; title: string; nickname: string | null; project: string; path: string;
    updatedAt: string; prompts: string[]; isActive: boolean; directoryMissing: boolean;
    usage: { models: ModelUsage[]; totalCostUsd: number | null };
  };
  // ModelUsage: { model, inputTokens, outputTokens, cacheCreationInputTokens,
  //              cacheReadInputTokens, costUsd }
  ```
- **No global state/query library** — all session state (list, filters, pagination, selection,
  pending actions) lives in `src/hooks/useSessions.ts` as plain `useState`/`useEffect`; filters and
  pagination are mirrored to URL query params via `useUrlState.ts`. No polling/websocket — the
  list only refetches on mount or after an explicit `refresh()`/mutation, so it won't reflect
  changes made outside the app (e.g. editing `~/.claude/projects` by hand) until reloaded.
- **No CI** — there's no `.github/workflows`. `yarn lint`/`yarn typecheck` and the Husky
  pre-commit hook are the only checks; nothing runs them on push, so run both yourself before
  calling a change done.
- README.md has install/run instructions and the desktop-shortcut setup — don't duplicate that
  here, refer to it for setup questions.

## Cross-platform caveats

- Terminal launching (`sessionService.ts`: `launchMacTerminal`, `launchWindowsTerminal`) and the
  standalone `start-windows.bat` / `start-mac.command` scripts are written from documented
  `osascript`/`wt.exe`/`cmd.exe` behavior only — nobody has run them on real Mac/Windows hardware.
  Don't assume they work; confirm before relying on them.
- Warp's tab-config directory (`getWarpTabConfigsDir()`) is only wired up for Linux
  (`$XDG_DATA_HOME/warp-terminal/tab_configs`). `launchWarp()` returns `false` immediately on
  darwin/win32 rather than guessing a path — a wrong guess would silently fail (Warp opens but
  ignores the resume command), which is worse than not offering Warp there. `WARP_DATA_DIR` env
  var overrides the directory if you need to test/wire up another OS.
  `getActiveResumeSessionIds()` (active-session detection, `sessionService.ts`) reads the CLI's own
  `~/.claude/sessions/<pid>.json` state files (`{pid, sessionId, ...}`, written on start, removed on
  clean exit) and confirms each pid is still alive with a signal-0 `kill`. It used to regex-match
  `ps -eo args=` for a `claude --resume <id>` command line, but the CLI (>=2.1.210) started hiding
  its args from `ps`/`/proc/<pid>/cmdline` — every process shows up as bare `claude` — which broke
  detection entirely (no active session ever showed as active). `process.kill(pid, 0)` works the
  same on Windows as on Linux/macOS, so this also lifts the old win32-only restriction — not
  smoke-tested on real Windows hardware, but no longer deliberately disabled there either.
- **Desktop-shortcut launch chain** (how clicking the app icon starts the dev servers):
  `install-shortcut.sh` templates `claude-session-manager.desktop.template` →
  `claude-session-manager.desktop` and installs it to `~/.local/share/applications/` and
  `~/Desktop/`. Its `Exec=` points at `open-terminal.sh` — the actual entrypoint for both the
  Desktop icon and the app-menu entry. `open-terminal.sh` probes both dev-server ports directly
  via `/dev/tcp/127.0.0.1/<port>` (frontend 58230, backend 58231, no `lsof`/`curl` dependency):
  if both are already up, it just `xdg-open`s a browser tab and exits — no second `yarn dev`. If
  **exactly one** is up (an orphaned process from a previous crash/partial shutdown — frontend and
  backend are meant to live and die together as one `yarn dev` under `concurrently`), it runs
  `fuser -k -n tcp` on both ports to clear the stray side before continuing, so every shortcut
  click ends with exactly one frontend + one backend, never a duplicate or a stale orphan left
  serving alongside a fresh instance. If neither is up, it launches a terminal running
  `start.sh` (which just cds into the project, makes sure `yarn` is on `PATH` — loading nvm
  manually if invoked non-interactively, since nvm only auto-loads for interactive shells — and
  runs `yarn dev`), preferring Warp (via a generated Tab Config TOML) and otherwise falling back
  through a `TERMINAL_LAUNCHERS` list. `open-terminal.sh` duplicates the terminal-picking logic in
  `sessionService.ts` instead of calling it — a Node dependency here would break the cold-bootstrap
  case where no system Node is on `PATH` yet (only nvm, which only loads for interactive shells).
  `scripts/check-terminal-launchers-sync.mjs` (run via `yarn lint`) fails the build if the two
  `TERMINAL_LAUNCHERS` lists drift apart — keep both in sync manually when editing either.
- No OS-level notifications by design — the app uses its own in-app toast instead of
  `notify-send`/similar, to keep native dependencies minimal.
- Window focus-stealing cannot be forced from the backend on Wayland (GNOME/Wayland blocks a
  background process from stealing focus for a window it spawns — a deliberate security feature).
  The in-app toast ("Terminal opened. Check your taskbar...") is the workaround. If X11 support is
  ever added, `wmctrl -a <title>` would work there, but that's a separate opt-in path.

## Architecture notes worth knowing before touching related code

- **Modals must render via `createPortal(..., document.body)`.** `SessionCard`'s root has a
  hover-transform utility class, which makes it a CSS containing block for any `position: fixed`
  descendant — a modal mounted as a normal child clips to the card's own bounding box instead of
  centering on the viewport. `PromptPreviewModal` and `UsageDetailsModal` both rely on the portal
  for this reason. Any new modal triggered from inside `SessionCard` (or another
  hover/transform-bearing element) needs the same treatment.
- **Tooltips on disabled buttons need a wrapper span.** A native `disabled` button doesn't fire
  hover events reliably, so `Tooltip` must wrap a non-disabled `<span>` around the button rather
  than the button itself. Used for Continue/Delete/nickname buttons when a session is active.
- **Active-session gating is enforced server-side, not just via disabled buttons.** Delete,
  continue, and nickname-edit all re-check `getActiveResumeSessionIds()` in `sessionService.ts` and
  throw `SessionActiveError` (mapped to HTTP 409) — the disabled UI state only covers the common
  case, not a session that becomes active between page load and request.
- **Nicknames are a local label, not a rename.** `setSessionNickname()` only writes to this app's
  own sidecar file (`~/.claude-session-manager/custom-titles.json`), never to
  `~/.claude/projects/`. There is no way for this app to change what Warp or Claude Code display —
  that's set by Claude Code itself via a `set_tab_title` tool call. `Session.title` is always the
  real auto-derived title; `Session.nickname` is a separate, independent field.
- **Assistant `usage` totals must be deduped by `message.id`** (`readSessionUsage` in
  `claudeProjects.ts`) — a single API response with multiple content blocks logs as multiple JSONL
  lines sharing one `message.id` and identical usage numbers; summing every line double-counts.
  A `"<synthetic>"` model marker with all-zero usage also needs filtering (internal retry marker,
  not a real call). Pricing table lives in `server/utils/pricing.ts` — update it if pricing drifts.
- **Full prompt search reads whole files.** `session.prompts` (used by list/search) is truncated to
  `MAX_PROMPT_PREVIEW_LENGTH` per prompt to keep the `/sessions` payload small. The preview modal
  fetches untruncated text on demand via `GET /sessions/:id/prompts` — don't reuse the truncated
  list field for anything meant to show full prompt text.
