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
  - `src/services/` — `sessionsApi.ts` / `tasksApi.ts` / `cleanupApi.ts` / `systemApi.ts`, thin
    axios wrappers around the backend, all sharing `withServerErrorMessage` from `src/utils/apiClient.ts`
  - `src/utils/` — cross-component client-side helpers: `apiClient.ts` (the error-unwrapping
    above), `formatDate.ts`/`formatPath.ts`/`formatUsage.ts`, `sessionInsights.ts`/`sessionSize.ts`
  - `server/routes/` — `sessions.ts`, `tasks.ts`, `cleanup.ts`, `system.ts` (Express routers, thin
    — error mapping only), sharing `extractStringField`/`extractBooleanField` from
    `server/utils/httpBody.ts`
  - `server/services/` — `sessionService.ts` (core logic: list/delete/continue/nickname sessions,
    active-session detection), `taskService.ts` ("new task" flow), `cleanupService.ts` (stale-
    worktree scan), `updateService.ts` (self-update via git pull)
  - `server/utils/` — `git.ts` (every git call this app makes), `claudeProjects.ts` (JSONL
    parsing), `claudeTrust.ts` (pre-accepting workspace trust for app-created worktrees),
    `nicknames.ts` (sidecar file), `httpBody.ts` (the route helpers above), `pricing.ts` (token
    cost table)
- **API surface** (see README.md for the full table): `GET /sessions`, `GET
/sessions/:id/prompts`, `PATCH /sessions/:id/nickname`, `DELETE /sessions/:id`, `POST
/sessions/:id/continue`, `POST /sessions/:id/worktree`, `DELETE /sessions/:id/worktree`, `POST
/sessions/:id/checkout-and-resume`, `POST /sessions/:id/compact-summary`, `POST
/sessions/:id/compact-continue`, plus `/system/update*` routes for the self-update feature.
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
    started in (see `findSessionCwd`'s doc comment), so a _past_ session can never be resumed from
    a different folder, worktree or not — "Create worktree" always starts a brand-new
    conversation, never continues an existing transcript.
  - **Every worktree this app creates gets its trust pre-accepted** (`markWorktreeTrustAccepted`,
    `server/utils/claudeTrust.ts`) — writes `hasTrustDialogAccepted: true` for the new worktree's
    absolute path into the CLI's own `~/.claude.json` (`projects["<path>"]`), atomically (temp
    file + rename), right after creating it and before ever opening a terminal into it. Found by
    direct reproduction: `claude --worktree <name>` fails in about a second with "Workspace trust
    not yet accepted" and creates nothing when run from an as-yet-untrusted directory — with no
    way for this app to detect that from a detached, fire-and-forget terminal spawn, so the UI
    would show a plain success toast regardless. Called from both `createWorktreeWithBranch`
    (the "New task" modal's own git-based creation) and `createSessionWorktree` just below (which
    predicts the CLI's own `<repoRoot>/.claude/worktrees/<name>` convention for the worktree it's
    about to ask the CLI to create, confirmed by direct reproduction) — every worktree this app
    ever creates is a git-managed subdirectory of a repo the user is already trusted in, never an
    arbitrary folder, so pre-accepting trust on the app's behalf is a narrow, scoped exception,
    not a blanket "trust everything" change.
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
  - **Resuming an inactive session checks the _live_ state, not the cached list** —
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
- **"Worktree → root" sync's "reset root" step** (shared by both wizard modes and the standalone
  quick action — `discardWorkingTreeChanges`/`listAppStashes` in `git.ts`, `RootStatus.appStashes`)
  stashes root's uncommitted changes rather than discarding them outright, but a plain `git stash
  push -m "worktree-to-root: root's pre-sync state"` on every run leaves `git stash list` with
  several entries reading identically after a few resets in one sitting — confirmed while
  dogfooding the copy → reset → repeat loop this feature is built for — with the only place the
  actual SHA for any one of them ever surfaced being a success toast at the moment it was created.
  Fixed two ways: the stash message now embeds the branch root was on and a timestamp, and
  `getRootStatus` (backing both `ResetRootConfirmModal` and the wizard's own confirm step) returns
  every stash this feature has ever created here (`listAppStashes`, filtered by message — note the
  `.includes` not `.startsWith`, since git prepends its own `"On <branch>: "` to whatever message a
  stash is pushed with) so a forgotten reset stays recoverable (`StashList` in
  `WorktreeToRootModal.tsx`, with a one-click "copy `git stash apply <sha>`" per entry) without
  the user needing to remember a SHA from a vanished toast.
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
    `branchTypes` (the "Branch type" select's options, first entry = the default selection),
    `useWorktreeByDefault` (the "don't use worktree" checkbox's default state), and
    `useAutoPermissionModeByDefault` (the "--permission-mode auto" checkbox's default state).
    Created lazily on first save; a fresh clone (or a missing/malformed file) just falls back to
    hardcoded defaults —
    `getUserPreferences()` never throws over it. Hardcoded defaults are just `["feature", "fix"]` —
    a custom ("Other") branch type that's actually used to create a task gets *prepended* to
    `branchTypes` automatically (best-effort PUT right after the "launch" step succeeds), becoming
    the new default selection (`branchTypes[0]`) rather than landing at the end of the list — no
    separate "manage branch types" UI, it just remembers itself; to
    reorder/remove entries, hand-edit the JSON file directly. `useAutoPermissionModeByDefault` is
    remembered the same "no separate save step" way, right alongside it — unlike the prompt/
    worktree-default fields (see below), there's no meaningfully different "draft" value worth
    preserving across an accidental close for a single checkbox, so it's just always whatever it
    was last left at. That checkbox appends the CLI's own `--permission-mode auto` flag to the
    launched `claude` command (`launchTaskTerminal` in `taskService.ts`) — relevant specifically
    for this app's own terminal-launching flows: a backgrounded/unfocused terminal window
    (Wayland blocks this app from stealing focus for one it spawns, see above) can't be answered
    until the user happens to notice it, so a session that never needs to ask doesn't get stuck
    waiting on a permission prompt nobody saw. The prompt and worktree-default fields
    each get their own "Save as default"/"Use as default" link (shown only when the field's
    current value differs from what's stored), same UX for both. Every write is a full-object PUT
    (the route validates the whole shape), so each save path must include the _stored_, not the
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
- **"Compact & continue"** (`SessionCard.tsx`'s scissors icon, `SessionSizeGateModal.tsx`,
  `CompactContinueModal.tsx` → `server/utils/claudeCli.ts`, `server/utils/sessionContinuations.ts`,
  `getCompactionDraft`/`startCompactedContinuation` in `sessionService.ts`) exists because `/compact`
  run inside a Claude session never shrinks that session's `.jsonl` — it's append-only, so the size
  meter keeps climbing regardless. The only real lever is starting a fresh, lighter session seeded
  with a summary of the old one.
  - **Draft summary comes from a real headless turn**: `claude --resume <id> --print
    --permission-mode plan "<instruction>"` (`runClaudeHeadlessSummary`), not just the CLI's own
    `away_summary` recap — `plan` mode lets the model read around the repo for a better-grounded
    summary while guaranteeing it can't edit anything, safe to fire from the backend unattended.
    **`--tools ""` was tried first and is broken** — confirmed by direct reproduction: it's a
    variadic flag (`--tools <tools...>`) that swallows the prompt string following it as another
    tool name, leaving no actual prompt and producing a confusing "No deferred tool marker found"
    error. Falls back to the recap, then the title, then the first message if the headless call
    fails/times out — same cascade `resolveTitle` already uses elsewhere.
  - **The new ("pt2") session's id is chosen up front** via the CLI's own `--session-id <uuid>`
    flag, generated server-side right before linking and launching — avoids the "discover the new
    session's id after the fact by matching directory + timestamp" problem earlier designs in this
    file solve for (see the worktree section above); here there's just nothing to discover.
  - **The link lives in its own sidecar**, `~/.claude-session-manager/session-continuations.json`
    (`sessionContinuations.ts`, same pattern as `nicknames.ts`): `{ [newSessionId]: { continuesFrom:
    oldSessionId, createdAt } }`. The reverse edge (`continuedBySessionId`) isn't stored — it's
    derived by scanning for the one entry whose `continuesFrom` matches, so there's nothing to keep
    in sync. `listSessions()` decorates both directions the same way it decorates `nickname`.
  - **`SessionSizeGateModal`** intercepts "Retomar (terminal)" client-side (`resumeSession` in
    `useSessions.ts`) once `sessionSizeStatus(sizeBytes) !== "healthy"`, offering "continue anyway"
    (re-calls with `skipSizeGate: true`) or "compact instead" — the Resume button itself stays
    always-enabled, same as the pre-existing active-session-conflict check right above it.
  - **Continuation badges** (violet, both cards) resolve the *other* side's title from
    `useSessions.ts`'s `allSessions` (the full unfiltered/unpaginated list — the linked session
    might not be on the current page) and, on click, jump to it by setting the search query to its
    id and clearing project/date filters; on hover, they set `highlightedSessionId` so the other
    card (if visible on the current page) gets a violet ring — purely a `SessionsPage.tsx`-level
    state, no new sort/grouping logic.

## to-do's

- **Backend error messages bypass the pt/en/es translation system — in progress, converting one
  file at a time.** The gap: `withServerErrorMessage` (`src/utils/apiClient.ts`) used to re-throw
  the server's `{error: "<message>"}` body verbatim as `Error.message`, and every caller did
  `showToast(err instanceof Error ? err.message : t(...))` — so any time a request actually failed
  server-side, the toast was raw English no matter what language was selected, while every
  *client-side* fallback message right next to it was properly translated.
  - **The mechanism is now built and in use**: `server/utils/httpError.ts`'s `AppError` class
    carries a stable machine-readable `code` alongside the English `message`; `sendErrorResponse`
    (same file) includes it in the JSON error body; `resolveApiErrorMessage`
    (`src/utils/apiClient.ts`) looks the code up in its own `SERVER_ERROR_CODE_KEYS` map and
    returns a translated string, falling back to the raw English message for any code that isn't
    in the map yet (or wasn't sent at all, from a not-yet-converted route) — every one of the ~28
    frontend call sites that used to do `err instanceof Error ? err.message : t(fallbackKey)` now
    calls `resolveApiErrorMessage(err, t, fallbackKey)` instead, so a backend file's throw sites
    getting converted is the *only* remaining work per file — no more frontend-side changes needed.
    Verified end-to-end with `npx tsx` importing `resolveApiErrorMessage` + `translations.ts`
    directly (a real code translates; an unrecognized code and a plain `Error` both still fall
    back correctly).
  - **Converted so far**: `SessionNotFoundError` → `SESSION_NOT_FOUND`, `SessionActiveError` →
    `SESSION_ACTIVE` (both in `sessionService.ts`, used throughout `sessions.ts`'s routes — these
    two classes alone cover the large majority of what users actually hit: deleting/resuming/
    renaming a session that's active elsewhere, or one that no longer exists), the repeated
    "Invalid session id" throws → `INVALID_SESSION_ID` (`invalidSessionIdError` helper, same
    file), and the `/sessions/:id/pr-url` route's "no PR link" 404 → `NO_PR_LINK`. `sessions.ts`
    itself was also refactored: every route's repeated `if (err instanceof X) {...}` chain is now
    one `sendErrorResponse(res, err, notFoundOrActive)` call.
  - **Not converted yet** (still raw English `throw new Error(...)`, falls back gracefully — no
    codes sent, `resolveApiErrorMessage` just shows the English message like before):
    - `sessionService.ts`'s own ~35 *other*, one-off messages (terminal-launch failures, missing
      working directories, worktree-specific checks, ...) — each would need its own distinct code
      (unlike the three shared classes above, these aren't reused across many call sites, so
      there's less leverage per conversion).
    - `server/services/taskService.ts`, `usageService.ts`, `cleanupService.ts`, `updateService.ts`
    - `server/utils/repoRoot.ts`, `git.ts`
    - `server/routes/tasks.ts`, `cleanup.ts` (their own throws, not the ones re-thrown from
      `sessionService.ts`)
  - Pick the next file by how often a user is likely to actually hit its error paths, same
    reasoning that put `sessionService.ts`'s shared classes first — `taskService.ts` (New Task
    modal) is probably next, then `usageService.ts`.

- **Future idea: deeper Jenkins integration for `env/*` branches.** "New task" branches created
  with the `env/` prefix (this convention is per-repo, not universal — the concrete case so far
  is `hg-led-mainsite`, a Jenkins multibranch job) get their own pipeline run, and its console
  output ends with one `Success! Your site should be available at http://...` line per
  language/locale (e.g. `mx-env-led-54351-mainsite-hostgator`, `br-env-...`) — copying these into
  the Jira card is a recurring manual chore. Two catches worth remembering if this gets built:
  Jenkins doesn't auto-trigger on the very first push to a brand-new `env/` branch (only a second
  push or a manual "Build Now" click starts it), and a full run takes ~15-30min. A real
  integration would:
  - **Trigger the build via the Jenkins REST API** (`POST
    .../job/<job>/job/<url-encoded-branch>/build`) right after the worktree's branch is pushed,
    instead of relying on the user to notice and click "Build Now" or make a throwaway second
    commit — this is the part that actually fixes the annoying first-push gap, not just a
    convenience on top of it.
  - **Poll for completion and scrape the console log** — `.../lastBuild/api/json` for
    build/result status, `.../lastSuccessfulBuild/consoleText` for the log — and extract every
    line matching `Success! Your site should be available at http://`, presented somewhere easy
    to copy into Jira (e.g. a small panel/toast listing all the links found).
  - **Needs real Jenkins credentials (username + API token)**, which is a new class of secret
    this app has never had to store — contrast with the usage-limits badge (`usageService.ts`),
    which only ever *reads* a credential the Claude CLI already wrote to disk and never persists
    one of its own. Wherever this token lives (a new local config file, env var, etc.), treat it
    with the same discipline as that badge's access token: read into memory, used once, never
    logged or echoed back to the client.
  - Given the ~15-30min pipeline runtime, "check build status/log" should be an on-demand action
    (a button the user clicks when they remember), not a background poll — consistent with this
    app's no-polling design everywhere else (see `useSessions.ts`'s module doc).
  - The Jenkins job base URL + job name would need to be configurable per project (right now
    there's no per-external-project settings surface — `userPreferences.json` is one global file
    for the whole app, used by the New Task modal's own defaults) since the job name is specific
    to each repo, not derivable from anything git already exposes.
  - Two cheaper, credential-free steps worth shipping first, since they only build a URL and open
    it in the user's own already-authenticated browser (no Jenkins/host API call at all): an
    "Open Jenkins" button for `env/*`-branched sessions, and an "Open PR" button that resolves
    `origin`'s remote URL to a host + `owner/repo` slug (this app manages both GitHub- and
    Bitbucket-hosted projects — `hg-led-mainsite`'s own remote is `bitbucket.org`, not
    `github.com`) and opens the matching compare/create-PR page:
    `https://github.com/<owner>/<repo>/compare/<branch>?expand=1` for GitHub, or
    `https://bitbucket.org/<workspace>/<repo>/pull-requests/new?source=<branch>` for Bitbucket —
    Bitbucket has no direct "jump straight to the existing PR for this branch" URL the way
    GitHub's compare page effectively has, so this lands on the create-PR form, and Bitbucket
    itself shows a banner linking to the existing PR when one's already open for that branch.
