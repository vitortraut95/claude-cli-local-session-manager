# Instructions for Claude

This file is auto-loaded at the start of every session in this repo. Read it before touching
anything OS-specific — it exists so we don't re-derive this context (and re-burn tokens exploring
the codebase) every time cross-platform support comes up.

## What this app is

Local web app that manages Claude CLI sessions: reads the `*.jsonl` files `claude` writes to
`~/.claude/projects`, lists them, and can resume one (`claude --resume <id>`) in a new terminal
window. Monorepo (Yarn workspaces): root = React/Vite/Tailwind frontend, `server/` = Express
backend. See `README.md` for setup/run instructions.

**Current status: Linux-only** (README says so explicitly). This file tracks what would be needed
to ship it on Windows and macOS too, since that came up as a future goal.

## Cross-platform support — status and plan

### Already fully cross-platform, no action needed
- `getClaudeProjectsDir()` (`server/utils/claudeProjects.ts`) — uses `os.homedir()` + `path.join`,
  works on every OS. (Unverified assumption: the Claude CLI itself stores sessions at
  `<homedir>/.claude/projects` on Windows/macOS too — should be confirmed once someone actually
  tests there, but nothing in *this* repo needs to change for it.)
- CRLF handling in the `.jsonl` reader (`claudeProjects.ts`, `readline` interface has
  `crlfDelay: Infinity`).
- `package.json` scripts (root and `server/`) — no `FOO=bar cmd` env-var-prefix syntax anywhere,
  `concurrently` is cross-platform, all `&&` chains work in `cmd.exe` too.
- `git`/`yarn` calls in `server/services/updateService.ts` and `server/scripts/run-update.mjs` —
  use `execFile` (not a shell string), both binaries exist natively on every OS.
- Session-id validation (`isSafeSessionId`, `sessionService.ts`) — plain regex, no path-separator
  assumptions.

### Made more portable already (this session's work)
- **`commandExists()`** (`server/services/sessionService.ts:182-198`) — used to shell out to
  `which` (POSIX-only, no `which` on Windows). Now a pure-Node PATH scan (checks every `PATH`
  entry, plus `PATHEXT` suffixes on `win32`). No native binary dependency at all anymore.
- **`getWarpTabConfigsDir()`** (`sessionService.ts:205-211`) — added a `WARP_DATA_DIR` env var
  override. Without it, still only targets Linux (`$XDG_DATA_HOME/warp-terminal/tab_configs`) —
  see "Still needed" below, the real macOS/Windows Warp paths aren't filled in yet.
- **`sanitizedSpawnEnv()`** (`sessionService.ts:127-142`) — the VS Code Snap env-var workaround
  now short-circuits unless `process.platform === "linux"` (it's a Linux/Snap-only concept, this
  was previously a silent no-op elsewhere, now it's explicit).
- **"Stop application" feature removed entirely** (button in `Header.tsx`, `POST /system/shutdown`
  in `server/routes/system.ts`, `stopApplication()` in `src/services/systemApi.ts`) — it used to
  read `/proc/[pid]/stat` to find the process group and `SIGTERM` it (Linux-only, and a **latent
  macOS bug** too, since macOS has no `/proc`). Rather than keep porting this, the feature was cut:
  whoever wants to stop the app just closes the terminal running `yarn dev`. One less
  platform-specific mechanism to ever have to fix for Windows/macOS.

### Still Linux-only — real per-OS work needed, not a quick swap

1. ~~Terminal launching~~ — **implemented, but NOT SMOKE-TESTED ON REAL WINDOWS/MACOS MACHINES.**
   `sessionService.ts` now dispatches on `process.platform` inside `continueSession()`:
   - **darwin** → `launchMacTerminal()` (`sessionService.ts:265`): opens Terminal.app via
     `osascript -e 'tell application "Terminal" to activate / do script "<cd cwd && command>"'`.
     No "press enter" pause needed — `do script` leaves the shell at a fresh prompt when the
     command exits, same as Linux `read -p` was working around.
   - **win32** → `launchWindowsTerminal()` (`sessionService.ts:286`): tries `wt.exe -d
     <cwd> cmd /k <command>` first, falls back to `cmd.exe /c start /d <cwd> cmd /k <command>`
     (every Windows install has `cmd.exe`). `/k` keeps the window open+interactive after the
     command exits, same reasoning as `do script` above.
   - **everything else (linux/default)** → unchanged, the original `TERMINAL_LAUNCHERS` loop.
   - Both new branches were written from documented `osascript`/`wt.exe`/`cmd.exe` behavior only —
     **nobody has run this on a real Mac or Windows box yet.** Before trusting it: confirm
     Terminal.app actually opens focused with the right cwd and command; confirm `wt.exe`/`cmd.exe`
     quoting holds up for `cwd` values containing spaces or the characters cmd.exe treats
     specially (`&`, `%`, `^`, parentheses) — the current Windows quoting is basic and unhardened.
   - Warp is **not** attempted on darwin/win32 (`launchWarp()` early-returns `false` off Linux) —
     see #2, still unresolved.
   - **The parallel, duplicate implementation in `open-terminal.sh` (root) was NOT updated for
     other OSes** — it's still Linux-only (`TERMINAL_LAUNCHERS` array, same fallback list). It
     only backs the optional GNOME desktop shortcut, not the web UI's "Continue" button, so
     porting it wasn't urgent, but it'll need the same treatment if the desktop-shortcut feature
     ever needs to work cross-platform too.
   - **True runtime consolidation (bash script calls the same code as the TS server) was
     investigated and ruled out for now.** Confirmed empirically on this machine: in a clean
     non-interactive shell — `env -i HOME="$HOME" bash -c 'command -v node'` — `node`/`yarn`
     resolve to nothing (no system-wide Node install, only nvm, which `~/.zshrc` loads for
     interactive shells only). `open-terminal.sh` runs in exactly that non-interactive context
     when launched from a `.desktop` file, *before* `start.sh`'s own nvm-sourcing dance ever gets
     a chance to run — so making the bash script depend on Node to pick a terminal emulator would
     break the cold-bootstrap case it exists to handle. Don't "fix" this by having
     `open-terminal.sh` shell out to a Node helper without re-solving that problem first.
   - **What was done instead**: `scripts/check-terminal-launchers-sync.mjs` (repo root) parses the
     `TERMINAL_LAUNCHERS` list out of both `sessionService.ts` and `open-terminal.sh` and fails if
     they've drifted (different binaries or order). Wired into `yarn lint` as of this commit.
     **Not yet wired into the `.husky/pre-commit` hook** (which currently runs `lint-staged` +
     `typecheck` only, not `yarn lint`) — so drift is still only caught when someone runs
     `yarn lint` manually or in CI, not automatically on every commit. Worth revisiting if this
     list starts changing more often.
2. **Warp's real data directory on macOS/Windows is still unverified**, and now explicitly
   disabled there rather than guessed: `launchWarp()` (`sessionService.ts`) returns `false`
   immediately when `process.platform !== "linux"`, so `continueSession()` (which always tries
   Warp first, no toggle anymore — see below) silently falls through to the plain-terminal branch
   above on Mac/Windows. Reasoning: a wrong guessed path wouldn't error, it'd
   silently write the tab-config TOML to a folder Warp never looks at — Warp would open, but
   ignore the resume command, which is a more confusing failure than just not offering Warp there.
   `WARP_DATA_DIR` env var override still exists (see above) as the escape hatch once someone
   confirms the real per-OS defaults and wants to wire this back up (macOS is probably somewhere
   under `~/Library/Application Support/dev.warp.Warp-Stable/`, Windows under `%APPDATA%\Warp\` —
   **both still guesses, not verified**).
3. **Desktop-shortcut installer was Linux/GNOME-only; Windows and macOS launchers now exist too,
   NEITHER SMOKE-TESTED ON REAL HARDWARE.** Original Linux stack unchanged: `install-shortcut.sh`,
   `open-terminal.sh`, `start.sh`, `claude-session-manager.desktop.template` — `.desktop` file
   format, `xdg-user-dir`, `gio set ... metadata::trusted`, `update-desktop-database`, a Bash-only
   `/dev/tcp/...` port probe (`open-terminal.sh:9`), `chmod +x`. Per the "don't try to port this,
   build separate installers" call made earlier:
   - **`start-windows.bat`** (repo root) — standalone, no shared code with the Linux scripts, no
     Node dependency for the "is it already running" check (uses `curl.exe`, bundled with Windows
     since 2018, instead of the `/dev/tcp` trick), and no PATH-bootstrapping dance like
     `start.sh`'s nvm-sourcing (Windows Node installers/nvm-windows update the persistent
     system/user `PATH`, unlike Unix nvm's shell-rc-only approach — a real platform difference,
     not an oversight). Shortcut creation is a documented PowerShell one-liner in `README.md`
     (`New-Object -ComObject WScript.Shell` → `.CreateShortcut()`) rather than a committed
     installer script, since raw `cmd.exe` has no way to create a `.lnk` at all.
   - **`start-mac.command`** (repo root) — simpler than the other two: double-clicking a
     `.command` file already opens Terminal.app on its own, so unlike Linux/Windows there's no
     terminal-picking logic in the script at all, just the port-check/`yarn dev`/keep-open dance.
     Reuses the exact same `/dev/tcp` port probe as `open-terminal.sh` (bash built-in, works
     identically on macOS's bash, no curl dependency needed there either). Shortcut creation is a
     plain `ln -sf` one-liner in `README.md` — deliberately *not* `osascript`/Finder-scripting
     (`tell application "Finder" to make alias ...`), since that can trigger macOS's Automation
     permission prompt the first time; a symlink needs no permission and Finder follows it
     transparently for double-click execution.
   **Still needed**: someone with real Windows and Mac hardware to double-click each script and
   confirm the port-check/fallback-to-`yarn dev` logic and both shortcut-creation snippets
   actually work.

### Decisions already made (so we don't re-litigate them)

- **No OS-level notifications.** We considered using `notify-send` (Linux) to signal that a
  terminal opened, as a workaround for GNOME/Wayland's focus-stealing prevention (see below). User
  explicitly chose to **keep native/OS dependencies minimal** and use the app's own in-app toast
  instead (`src/hooks/useSessions.ts`, `resumeSession`, message: *"Terminal opened. Check your
  taskbar if it didn't come to the front."*, rendered by `src/components/ToastViewport.tsx`, fixed
  top-left, 3.5s). Any future "let the user know something happened" need should default to this
  toast system, not a native notification API, unless there's a concrete reason an in-app toast
  can't work (e.g. the browser tab is closed).
- **Window focus-stealing cannot be forced from the backend on Wayland.** This dev machine runs
  GNOME on **Wayland** (`XDG_SESSION_TYPE=wayland`). `wmctrl`/`xdotool` aren't installed and
  wouldn't reliably work even if they were — Wayland compositors deliberately block a background
  process with no live window-surface (this Node server) from stealing focus for a window it
  spawns; that's a security feature, not a bug to route around. `DESKTOP_STARTUP_ID` (the old X11
  trick) doesn't help either since gnome-terminal here is a native Wayland client. **If X11/Xorg
  session support is ever wanted**, `wmctrl -a <title>` (after giving the spawned terminal a
  unique `--title`/`-T` flag) would work reliably there — but that's a separate, opt-in code path,
  not something to build blindly today.
- **`warp-terminal` and `gnome-terminal` are both installed on this dev machine.** There's no
  user-facing Warp on/off toggle anymore (the old `WarpToggle`/`useWarpPreference` were removed) —
  `continueSession()` (`sessionService.ts`) always tries Warp first unconditionally, falling back
  to the OS terminal launcher automatically when Warp isn't installed/available.

### Suggested order of attack, when this work actually starts

1. **Smoke-test on real machines — the single highest-priority item.** Nothing Windows/macOS-
   specific in this repo has run on real hardware yet:
   - `launchMacTerminal`/`launchWindowsTerminal` (`sessionService.ts`, used by "Continue
     (terminal)") — confirm Terminal.app/Windows Terminal actually open, in the right directory,
     running the right command; check whether they come to focus or hit the same focus-stealing
     issue Linux/Wayland has (worth re-checking whether macOS/Windows are more permissive here
     before assuming the in-app toast is the only option there too).
   - `start-windows.bat` and `start-mac.command` (repo root) — confirm the "is it already
     running" check and the `yarn dev` fallback both work on each OS, and that both
     shortcut-creation snippets in `README.md` (PowerShell `.lnk` / `ln -sf` symlink) actually
     produce a working Desktop icon.
2. Confirm real Warp data-dir paths for macOS/Windows (needs someone with those machines, or the
   Warp docs/support to confirm), then wire `launchWarp()` back up for those platforms (currently
   hard-disabled off Linux — see above).
3. Retire the duplicate logic in `open-terminal.sh` (still Linux-only, wasn't touched by #1) once
   there's a reason to make the desktop shortcut cross-platform too — a drift *guard*
   (`scripts/check-terminal-launchers-sync.mjs`, wired into `yarn lint`) exists now, but the two
   implementations are still separate; true unification is blocked on solving the
   Node-not-on-PATH cold-bootstrap problem first (see above).

## Feature backlog — dev-experience improvements

Brainstormed list of things a dev using the Claude CLI might feel is missing, that this app
(not the CLI itself) could address. Not cross-platform related — pure product/feature ideas.
Update this list's checkmarks/notes as items get built or dropped.

### Search & context (data already sitting in the `.jsonl`, just needs exposing)
- [x] **Full-text search across message content** — done, see below.
- [x] **Token usage / cost per session** — done, see below.
- [x] **Proactive "stale directory" badge** — done, see below.
- [ ] **Message/turn count or session size indicator** on the card.

### Organization & management
- [x] **Manual session rename** — done, see below.
- [ ] **Favorite/pin sessions.**
- [ ] **Bulk select + delete.**
- [ ] **Group the list by day/project** instead of a flat grid.

### Workflow
- [x] **"Session currently active" indicator** — done, see below.
- [ ] **Export a session as Markdown** (for pasting into a PR/ticket).
- [ ] **Keyboard shortcuts** (`/` focus search, `j`/`k` navigate, `Enter` continue, `Del` delete).
- [ ] **Auto-refresh** instead of the manual "Refresh sessions" button (polling or a directory
  watcher).

### More ambitious / lower priority
- [ ] Stats dashboard (sessions per project, over time).
- [ ] Correlate a session with the git diff/files it actually touched.

### Implemented: full-text search + prompt-preview modal

- **Backend** (`server/utils/claudeProjects.ts`): `readSessionPrompts(filePath)` reads the
  *entire* `.jsonl` (unlike `readSessionHead`, which stops after the first user prompt) and
  collects every human-authored prompt, reusing the same `type === "user"` / `!isSidechain` /
  `!startsWith("<")` filtering `readSessionHead` already used to find the first one. Capped at
  `MAX_PROMPTS_EXTRACTED` (30) prompts, each truncated to `MAX_PROMPT_PREVIEW_LENGTH` (300) chars,
  so one huge session can't bloat the `/sessions` list payload. Wired into `buildSession()`
  (`sessionService.ts`) alongside the existing head/stat reads; `Session` (both `src/types` and
  `server/types`) gained a `prompts: string[]` field.
- **Search**: `useSessions.ts`'s existing client-side `matchesQuery` filter (already checking
  title/project/id) now also spreads `...session.prompts` into the fields it checks — no new
  endpoint, no debouncing, same architecture as before, just a longer list of fields to `.includes()`
  against. Chosen over a server-side search endpoint because the session count for a single local
  user is small (tens, not thousands) — reading full file content for every session on every list
  load is cheap enough locally to not justify a second, async search architecture.
- **Preview modal** (`src/components/PromptPreviewModal.tsx`): a numbered list of a session's
  prompts, opened via a small icon button next to "Updated ..." on `SessionCard`.
  **Rendered via `createPortal(..., document.body)` — this is load-bearing, not decorative.**
  `SessionCard`'s root div has `hover:-translate-y-0.5` (a transform-on-hover utility); since the
  button that opens the modal lives *inside* the card, the user's cursor is hovering the card at
  the exact moment the modal mounts, which makes the card a CSS containing block for any
  `position: fixed` descendant — clipping the modal to the card's own tiny bounding box instead of
  centering over the full viewport. Confirmed by direct DOM measurement during development (moving
  the modal's DOM node to be a child of `<body>` immediately fixed its size/position). `ConfirmDialog`
  next to it doesn't hit this because it's rendered as a sibling in `SessionsPage`, never a
  descendant of a transform-bearing card — **any future modal triggered from inside `SessionCard`
  (or any other element with a hover/transform utility class) needs the same portal treatment,
  or it will intermittently render clipped to that element's box instead of centered on screen.**

### Implemented: active/inactive session indicator

- **Backend** (`server/services/sessionService.ts`): `getActiveResumeSessionIds()` runs
  `ps -eo args=` (no header, one full command line per row) and regex-matches
  `claude --resume (\S+)` against every line to build a `Set` of currently-resumed session ids.
  Called once per `listSessions()` call (not per-file), then merged into each session via
  `isActive: activeIds.has(session.id)`. `Session` (both `src/types` and `server/types`) gained
  an `isActive: boolean` field. Verified live: this very session's own `claude --resume` process
  shows up correctly, and a synthetic fake process (`exec -a "claude --resume <fake-id>" sleep`)
  was also correctly detected during development.
  - **Linux/macOS only** — explicitly skipped on `win32` (`process.platform === "win32"` returns
    an empty `Set` immediately) rather than guessing at a `tasklist`/WMI equivalent, same
    "disable rather than guess wrong" call as `launchWarp`. `args`/`ps -eo` are POSIX-standard, so
    no platform branching was needed between Linux (GNU ps) and macOS (BSD ps) — same command
    works on both.
  - Only detects sessions resumed **through this app's "Continue" flow or a manually-typed
    `claude --resume <id>`** — it greps process command lines, so it can't tell the difference
    between "resumed via this app" and "resumed by hand in some other terminal," which is
    actually the desired behavior (either way, the session file is in use).
- **Frontend** (`src/components/SessionCard.tsx`): a small floating dot, absolutely positioned in
  the card's top-right corner (`-top-1.5 -right-1.5`, needs `relative` on the card's root div to
  anchor to it rather than some further-up ancestor) — green + `animate-pulse` when active, red
  when not — wrapped in the existing `Tooltip` component (Radix, already portal-based internally,
  so it doesn't hit the containing-block bug described above).

### Implemented: proactive "stale directory" badge + Continue button gating

- **Backend** (`server/services/sessionService.ts`): `buildSession()` now also checks
  `directoryExists(head.cwd)` (the same helper `continueSession()` already used, just moved
  earlier in the flow) and sets `directoryMissing: boolean` on the session. An unknown/missing
  `cwd` (older session, or head parse didn't find one) is treated as `directoryMissing: false` —
  we only flag it once we positively know the original directory and it's gone, to avoid false
  positives blocking sessions we simply have no cwd data for. `continueSession()`'s own
  independent check on click is left untouched as defense-in-depth (protects direct API callers
  that bypass the UI).
- **Frontend** (`src/components/SessionCard.tsx`): an amber badge ("⚠ Original folder missing")
  rendered under the title when `directoryMissing`, and the "Continue (terminal)" button gets
  `disabled={isBusy || session.directoryMissing}`.
  - **Tooltip-on-disabled-button gotcha**: a native `disabled` button doesn't reliably fire hover
    events in most browsers, so wrapping `Tooltip` directly around a disabled `<button>` silently
    fails to show anything on hover. Fixed the same way Radix's own docs recommend: the button is
    wrapped in a plain (non-disabled) `<span className="flex flex-1">`, and that span — not the
    button — is what `Tooltip`'s `asChild` trigger wraps. **Same pattern needed for any future
    disabled-button tooltip in this app**, including the upcoming rename button below.
  - Verified live with a throwaway fake session (`~/.claude/projects/-tmp-fake-missing-dir-test/`,
    `cwd` pointing at a directory that doesn't exist, deleted again after testing): badge appeared,
    button visually disabled, click did nothing, tooltip showed the expected message on hover.

### Implemented: token usage / estimated cost per session

- **Backend** (`server/utils/claudeProjects.ts`, `readSessionUsage`): reads the *entire*
  transcript and sums `message.usage` (`input_tokens`, `output_tokens`,
  `cache_creation_input_tokens`, `cache_read_input_tokens`) per model. **Critical gotcha found
  during development**: a single API response with multiple content blocks (e.g. a `thinking`
  block followed by a `tool_use` block) is logged as multiple JSONL lines that share the same
  `message.id` and carry the *identical* usage numbers on every line — naively summing every
  `type: "assistant"` line double- (or N-times-) counts. Fixed by deduping on `message.id`,
  tallying each unique message exactly once. Also found or a `"<synthetic>"` model marker with
  all-zero usage on real transcripts (looks like an internal retry/injected-turn marker, not a
  real API call) — filtered out entirely in `summarizeUsage` (see below) since it's not a real
  call and its presence was incorrectly nulling out an otherwise-fully-known cost total.
- **Pricing** (`server/utils/pricing.ts`): a small per-model `$/MTok` table (input/output),
  captured from the `claude-api` skill's live-pricing reference on 2026-07-24 — **update this
  table if pricing drifts**, and note Sonnet 5 is at introductory pricing ($2/$10 per MTok)
  through 2026-08-31, reverting to $3/$15 after. Cache write/read aren't published as separate
  per-model rates — they're documented multipliers of the base input rate (1.25× for the default
  5-minute TTL, which is what Claude Code uses; 0.1× for a cache read). `summarizeUsage()` maps
  each model's raw usage to a cost, first filtering out any all-zero-usage entries (the
  `"<synthetic>"` case above), then returns `totalCostUsd: null` if *any remaining* model has
  unknown pricing — a partial sum would understate the real cost, which is worse than saying
  "unavailable." Verified with inline unit tests: known-model math checks out, an unknown model
  with real usage nulls the total, an unknown model with zero usage does not (gets filtered
  instead).
- **Frontend**: a `$` icon next to the prompt-preview icon on `SessionCard` (only shown when
  `session.usage.models.length > 0`), opening `UsageDetailsModal.tsx` — per-model token
  breakdown + cost, an "Estimated total," and an explicit disclaimer that this is not the user's
  actual bill (doesn't account for a Pro/Max subscription, promo pricing, etc.). Same
  `createPortal(..., document.body)` requirement as `PromptPreviewModal` — see that section above
  for why. Verified live: this very session showed real, correctly-deduped numbers (hundreds of
  millions of cache-read tokens on a long-running session, ~$30+ estimated cost) that only grew
  as the conversation continued, confirming the running total tracks accurately in real time.

### Implemented: manual session rename

- **Storage** (`server/utils/titleOverrides.ts`): a small sidecar JSON file at
  `~/.claude-session-manager/custom-titles.json` — deliberately **not** inside
  `~/.claude/projects/`, since that's the Claude CLI's own data and this app never writes to it.
  `{ [sessionId]: customTitle }`, capped at 100 chars (same cap as the auto-derived title).
  Setting a blank/whitespace-only title **deletes** the override key, reverting to the
  auto-derived title on the next load — there's no separate "reset" action needed.
- **Backend gate — this is the actual safety-relevant piece.** Per explicit user instruction, the
  rename must be blocked while the session is active, not just discouraged in the UI.
  `renameSession()` (`sessionService.ts`) re-checks `getActiveResumeSessionIds()` (the same
  active/inactive indicator function above) and throws `SessionActiveError` — mapped to **HTTP
  409** in `server/routes/sessions.ts` — if the id is currently `claude --resume`d. This is
  deliberately a *second* check, independent of the disabled button client-side: the button can
  only prevent the common case (page loaded, then user clicks rename while it's already
  displayed as active); it can't prevent a session that *became* active in the gap between page
  load and the request landing. Verified directly: `curl -X PATCH .../title` against this very
  session's own id (genuinely active) returned `409` with the expected message; renaming an
  inactive session and clearing it back to blank both worked and persisted correctly.
- **Frontend**: `RenameSessionModal.tsx` — pre-filled text input, portalled to `document.body`
  (same reasoning as the other SessionCard modals). **Deliberately mounted only while open**
  (`{showRenameModal && <RenameSessionModal .../>}` in `SessionCard.tsx`, not an always-mounted
  component with an `open` prop) — this was the clean fix for a real lint failure
  (`react-hooks/set-state-in-effect`) that showed up when the first draft tried to resync the
  input's local state from a `currentTitle` prop inside a `useEffect` on every open; mounting
  fresh each time means `useState(currentTitle)` already picks up the right value with no effect
  needed. **Any future modal with internal form state that needs to reset per-open should use
  this same conditional-mount pattern**, not an effect-based resync.
  - Pencil icon rendered next to the title (not in the bottom action row) — disabled +
    tooltip ("Close this session in its terminal before renaming.") whenever `session.isActive`,
    using the same disabled-button-tooltip wrapper trick as the Continue button. Modal closes
    immediately on submit (matching the existing delete-confirmation pattern in `SessionsPage.tsx`
    — the dialog isn't what shows pending state; the button's own spinner is), then
    `useSessions.ts`'s `renameSession()` calls the API and reloads the session list (not a local
    optimistic patch — the "reset to blank" case needs the server's resolved auto-title, which the
    frontend has no way to compute itself) and surfaces the specific server error message (e.g.
    the 409 case above) via `sessionsApi.ts`'s `renameSession()`, which re-throws an
    `axios.isAxiosError` response body's `.error` as a plain `Error` so the existing
    `err instanceof Error ? err.message : ...` catch pattern used everywhere else in this app
    picks it up without needing its own special case.
  - Verified live end-to-end in the browser: renamed an inactive session, confirmed the new title
    persisted after reload; cleared it back to blank and confirmed it reverted to the real
    auto-derived title; clicked the disabled pencil on this session's own (genuinely active) card
    and confirmed the tooltip showed and the click did nothing.
