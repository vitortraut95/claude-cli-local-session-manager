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
/sessions/:id/continue`, `POST /sessions/:id/worktree`, `DELETE /sessions/:id/worktree`, `POST
/sessions/:id/checkout-and-resume`, plus `/system/update*` routes for the self-update feature.
- **Session data model** — `src/types/session.ts` and `server/types/session.ts` define the _same_
  `Session` type independently (no shared package between the two workspaces) — a shape change
  needs both files edited, there's nothing that enforces they match:
  ```ts
  type Session = {
    id: string;
    title: string;
    nickname: string | null;
    project: string;
    path: string;
    workingDirectory: string | null;
    gitBranch: string | null;
    isWorktree: boolean;
    updatedAt: string;
    prompts: string[];
    isActive: boolean;
    directoryMissing: boolean;
    sizeBytes: number;
    subagentCount: number;
    activeTimeMs: number;
    usage: { models: ModelUsage[]; totalCostUsd: number | null; subagentCostUsd: number | null };
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
- **Git worktree support** (`server/utils/git.ts`, `createSessionWorktree`/`deleteSessionWorktree`/
  `stopSiblingAndResume` in `sessionService.ts`) lets a project with an already-active session be
  worked on from a second terminal without two Claude processes fighting over the same working
  tree.
  - **Creation delegates to the CLI's own `-w/--worktree [name]` flag** (`claude --worktree
    <name>`) rather than driving `git worktree add` by hand — the CLI already creates the linked
    worktree at `<repo>/.claude/worktrees/<name>` on a fresh `worktree-<name>` branch, locks it for
    the session's lifetime, and starts the conversation there in one step. It can't be combined
    with `--resume`: the CLI ties a session's transcript to the exact absolute directory it
    started in (see `findSessionCwd`'s doc comment), so a *past* session can never be resumed from
    a different folder, worktree or not — "Create worktree" always starts a brand-new
    conversation, never continues an existing transcript.
  - **`isLinkedWorktree`** (git.ts) tells a linked worktree from a repo's main checkout by
    comparing `git rev-parse --git-dir` vs. `--git-common-dir` (equal only for the main checkout).
    `listSessions()` computes this once per unique `workingDirectory` (not per session) to avoid
    redundant `git` spawns when many sessions share a directory.
  - **Deletion unlocks before removing** — the CLI's lock (reason `claude session <name> (pid ...
    start ...)`) persists after the process exits, so a plain `git worktree remove` fails with
    "cannot remove a locked working tree" long after Claude closed. `removeWorktreeAndBranch` also
    deletes the `worktree-<name>` branch afterward (best-effort) so a cleaned-up worktree doesn't
    leave an orphan ref behind. No `--force` on the removal itself — uncommitted changes still
    block it, same as declining to `rm -rf` uncommitted work anywhere else in this app.
  - **A worktree with zero sessions is invisible to this app.** `isWorktree` is only known once a
    session's `.jsonl` exists to read `workingDirectory` from — a worktree created but abandoned
    before any prompt was sent (no transcript ever written) has no session card to hang a cleanup
    button off of. Only shows up to a human running `git worktree list` by hand.
  - **Resuming an inactive session checks the *live* state, not the cached list** —
    `resumeSession` (useSessions.ts) refetches `/sessions` right before continuing, since the
    already-loaded list only reloads on mount/explicit refresh and another terminal could have
    started a session in the same directory since. If the fresh check finds one, it defers to
    `resumeConflict` state instead of resuming straight into a busy working tree.
  - **`stopSiblingAndResume`** is the "I know what I'm doing" escape hatch offered alongside
    "create a worktree" in that same conflict modal: SIGTERM (then SIGKILL after a timeout) the
    other terminal's `claude` process, `git checkout <branch>`, then resume the target session in
    the now-free directory — one server-side call rather than three client-orchestrated ones, so a
    partial failure can't leave the directory checked out to the wrong branch with nothing running
    in it. This can discard whatever the other terminal hadn't saved/committed; the client-side
    confirmation copy says so plainly rather than hiding it behind a generic "Continue?" dialog.
- **"New task" modal** (`Header.tsx` → `NewTaskModal.tsx`, `server/services/taskService.ts`,
  `server/routes/tasks.ts`) lets you paste a Jira link, pick/type a project folder, and get a
  brand-new isolated worktree + branch with a terminal already running `claude "<prompt>"` — the
  ticket id + your instructions passed as a positional arg, which starts an interactive session
  with that text as the first message (no temp file/stdin needed). Always mounted (like
  `UsageDetailsModal`'s convention, just via an `open` prop instead of conditional rendering) so
  closing it by accident (Escape, backdrop click) never loses what you typed — only the "Clear"
  button or a successful create actually resets the form.
  - **Everything the modal remembers lives in one gitignored `userPreferences.json`** at the repo
    root (`server/services/preferencesService.ts`, `GET`/`PUT /tasks/preferences`) — `defaultPrompt`,
    `branchTypes` (the "Branch type" select's options, first entry = the default selection), and
    `useWorktreeByDefault` (the "don't use worktree" checkbox's default state). Created lazily on
    first save; a fresh clone (or a missing/malformed file) just falls back to hardcoded defaults —
    `getUserPreferences()` never throws over it. A custom ("Other") branch type that's actually used to
    create a task gets appended to `branchTypes` automatically (best-effort PUT right after the
    "launch" step succeeds) — no separate "manage branch types" UI, it just remembers itself; to
    reorder/remove entries, hand-edit the JSON file directly. The prompt and worktree-default fields
    each get their own "Save as default"/"Use as default" link (shown only when the field's
    current value differs from what's stored), same UX for both. Every write is a full-object PUT
    (the route validates the whole shape), so each save path must include the *stored*, not the
    in-progress-draft, value for whichever fields it isn't intentionally changing — otherwise saving
    one field (e.g. a new branch type) would silently overwrite another (e.g. an unsaved prompt
    edit) with a draft the user never asked to persist.
  - **Split into 4 separate awaited API calls** (`repo-info` → `resolve-base-branch` → `worktree`
    → `launch`), not one — the modal shows each as its own step (pending/doing/done/error) so a
    failure is visibly attributable to one exact step instead of one opaque error. Learned this
    the hard way: an earlier version ran it as a single call, and a Warp TOML-escaping bug (see
    below) left a branch+worktree created with no way to tell from the UI that the last step
    (opening the terminal) was the one that actually failed.
  - **Base branch is always freshly fetched from origin** (`resolveBaseBranchRef` in `git.ts`) via
    `git fetch origin refs/heads/<branch>:refs/remotes/origin/<branch>` — deliberately not a
    `checkout`+`pull` of the local branch, since that would require checking it out somewhere and
    could collide with whatever's already checked out in the main folder. Falls back to a local
    ref only if the fetch fails (offline, no origin, local-only branch).
  - **Warp's TOML tab-config generation** (`launchWarp`/`toTomlBasicString` in
    `sessionService.ts`) must escape `\n`/`\r`, not just `\`/`"` — a TOML basic string can't
    contain a raw newline, so a multi-paragraph prompt (blank lines between sections) used to
    produce a `commands = [...]` value invalid enough that Warp refused to load the tab config at
    all ("TOML parse error ... invalid basic string"). Single-line test prompts never exposed
    this.
  - **Blocks on the Jira MCP being connected** (`getJiraMcpStatus` in `taskService.ts`) — shells
    out to `claude mcp list` (the CLI's own health-checked list; there's no faster "just check
    Jira" command) and looks for any configured server name matching `/jira|atlassian/i`, since
    the configured name varies per user/org. Re-checked every time the modal opens, plus a manual
    "Check again" button, since `claude mcp login` happens in a separate terminal this app
    has no way to observe.
- **Claude usage-limits badge** (`Header.tsx` → `UsageLimitsBadge.tsx`, `useUsageLimits.ts`,
  `server/services/usageService.ts`) reads the OAuth access token out of
  `~/.claude/.credentials.json` and calls the same undocumented account-usage endpoint
  (`GET https://api.anthropic.com/api/oauth/usage`, header `anthropic-beta: oauth-2025-04-20`)
  that Claude Code's own status line and third-party "Claude usage" VS Code extensions use —
  found by inspecting two such extensions' bundled source
  (`harshagarwal1012.claude-usage-bar`, `ajax1029.clusage`) already installed locally. Reports a
  generic `limits` array (`kind`, `percent`, `resetsAt`, ...) rather than hardcoding "session" and
  "weekly" fields, so a new limit kind Anthropic adds just shows up. **The access token itself
  never leaves `usageService.ts`** — it's read into memory, used once for the `Authorization`
  header, and only the computed percentages/timestamps cross into the response; never log or
  return the raw credentials file. Fetched once on mount (no polling, same philosophy as
  everything else in this app) with a 30s server-side cache and a manual click-to-refresh.

## to-do's

- **Add resume (terminal) with multi select.** When has selected items has only delete action, add
  also resume button.
- **Refresh on focus.** when the web page has focus (react option) run the refresh to avoid seeing
  unnupdated data.
- **"Worktree → root" sync — gaps found while dogfooding the real create-worktree →
  copy-to-root-to-test → clean-up loop** (`WorktreeToRootModal.tsx`, `ResetRootConfirmModal.tsx`,
  `sessionService.ts`'s `getWorktreeToRootPreview`/`getRootStatus`/`resetRootWorkingTree`/
  `applyWorktreeCopyToRoot`/`removeWorktreeAndCheckoutRoot`, `git.ts`'s
  `computeFileDiff`/`applyFileDiff`/`discardWorkingTreeChanges`). The 7 items below were fixed
  (in this relevance order); the last 2 are still open, deliberately, with why:
  - ✅ **Fixed — "copy" mode used to break if root had more than one nested worktree checked out
    at once.** `computeFileDiff` now excludes every entry `listWorktrees(repoRoot)` reports as
    nested inside `repoRoot`, not just the one being copied (previously only excluded the single
    `.claude/worktrees/<name>` embedded-repo entry for the worktree actually being synced — a
    second, unrelated sibling worktree under the same root would still land in `removed` and
    `applyFileDiff` would try to `rm()` a non-empty directory and throw).
  - ✅ **Fixed — "copy" mode's diff is now fork-point-aware, not a blind full-tree diff.**
    `computeFileDiff` computes `git merge-base <rootBranch> <worktreeBranch>` (new
    `getMergeBase`) and scopes the comparison to only the paths `git diff --name-status
    <mergeBase>` reports the worktree branch's own history (plus its uncommitted changes) as
    having touched (new `getTouchedPathsSinceMergeBase`) — root's own unrelated drift since the
    fork no longer gets misread as "belongs to the worktree" and flagged for deletion. Falls back
    to the old blind full-tree comparison when either branch is unresolvable (detached HEAD).
  - ✅ **Fixed — `resetRootWorkingTree`/the standalone reset action are now recoverable.**
    `discardWorkingTreeChanges` stashes via `git stash push --include-untracked` before clearing
    (instead of a bare `reset --hard` + `clean -fd`), and returns the resulting stash SHA (null
    if root had nothing dirty) all the way up through `POST .../reset-root`'s `stashRef` field —
    surfaced in both the wizard's and the standalone action's success toast as `git stash apply
    <sha>`.
  - ✅ **Fixed — added a standalone "Reset root" quick action.** `ResetRootConfirmModal.tsx`
    (triggered by the new amber toolbar icon next to "Clean up worktree") calls the same
    `reset-root` endpoint directly, without the full choice → preview → confirm → progress
    wizard — the loop this feature was actually built for (copy → test → reset → repeat) no
    longer needs 4 clicks through screens that don't apply just to discard root.
  - ✅ **Fixed — a "checkout"-synced session's card no longer dead-ends silently.**
    `WorktreeToRootModal` gets a new terminal "done" stage after a successful checkout-mode run
    (mode "copy" still closes immediately, nothing dead-ends there) offering "Delete this
    session" (reuses `SessionCard`'s existing `onDeleteRequest` flow via a new
    `onOfferDeleteSession` prop) or "Keep the card."
  - ✅ **Fixed — added a breadcrumb back to root's previous branch.**
    `removeWorktreeAndCheckoutRoot` captures root's branch (via `listWorktrees`) before touching
    anything and returns `{ previousRootBranch, newBranch }`; the success toast reads "root
    switched from `<previousRootBranch>` to `<newBranch>`."
  - ✅ **Fixed — the "confirm" stage no longer re-fetches the whole preview just to refresh the
    dirty-files list.** New lightweight `GET .../worktree-to-root/root-status` (`getRootStatus`,
    `RootStatus` type) returns just `{ repoRoot, rootBranch, rootDirtyFiles }` — used by both the
    wizard's final-confirm re-check and the standalone "Reset root" modal, neither of which ever
    needed the full (comparatively expensive) file diff.
  - **Still open — gitignored junk under root is never touched by "reset root," by design**
    (that's what keeps `node_modules` alive), **so anything a test run drops on a gitignored
    path accumulates forever**, invisible to git status. Deliberately NOT turned into a code
    change yet: an opt-in "deep clean" (`git clean -fdx`) toggle is a real, separate product
    decision (how is it surfaced, how obviously dangerous does the UI need to make "this can
    delete `node_modules`" look) — needs a specific choice from a human, not a silent addition.
  - **Still open — the file copy isn't atomic against a running dev server watching root.** A
    hot-reloader (nodemon, vite, docker-compose's `yarn dev`, ...) can observe a half-synced
    state mid-copy and throw/reload spuriously. Left alone deliberately: there's nothing generic
    to pause/notify without knowing what's actually watching root in a given setup — documenting
    it here is the honest option until there's a concrete "what should this app do about it" to
    implement.
