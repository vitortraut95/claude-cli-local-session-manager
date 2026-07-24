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
  tests there, but nothing in _this_ repo needs to change for it.)
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
     when launched from a `.desktop` file, _before_ `start.sh`'s own nvm-sourcing dance ever gets
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
     plain `ln -sf` one-liner in `README.md` — deliberately _not_ `osascript`/Finder-scripting
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
  instead (`src/hooks/useSessions.ts`, `resumeSession`, message: _"Terminal opened. Check your
  taskbar if it didn't come to the front."_, rendered by `src/components/ToastViewport.tsx`, fixed
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
   there's a reason to make the desktop shortcut cross-platform too — a drift _guard_
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

### Organization & management

- [x] **Local nickname** (originally shipped as "manual session rename") — done, see below.
- [x] **Bulk select + delete** — done, see below.

### Workflow

- [x] **"Session currently active" indicator** — done, see below.

### More ambitious / lower priority

- [ ] Stats dashboard (sessions per project, over time).

### Implemented: full-text search + prompt-preview modal

- **Backend** (`server/utils/claudeProjects.ts`): `readSessionPrompts(filePath)` reads the
  _entire_ `.jsonl` (unlike `readSessionHead`, which stops after the first user prompt) and
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
  button that opens the modal lives _inside_ the card, the user's cursor is hovering the card at
  the exact moment the modal mounts, which makes the card a CSS containing block for any
  `position: fixed` descendant — clipping the modal to the card's own tiny bounding box instead of
  centering over the full viewport. Confirmed by direct DOM measurement during development (moving
  the modal's DOM node to be a child of `<body>` immediately fixed its size/position). `ConfirmDialog`
  next to it doesn't hit this because it's rendered as a sibling in `SessionsPage`, never a
  descendant of a transform-bearing card — **any future modal triggered from inside `SessionCard`
  (or any other element with a hover/transform utility class) needs the same portal treatment,
  or it will intermittently render clipped to that element's box instead of centered on screen.**
- **Fixed: the preview modal used to reuse `session.prompts` directly, so any prompt over 300
  chars showed cut off mid-word (e.g. "...está no mob…", missing "mobile todo colado nas
  laterais. arrume isso" — reported by the user with a real example, "Fix course content layout
  on mobile", a 340-char prompt that got truncated exactly as designed for the list payload, just
  not what anyone wants in a dedicated preview).** `claudeProjects.ts` now splits the scanning
  logic into a shared `collectUserPrompts()`, with `readSessionPrompts()` (list/search, still
  truncated — unchanged behavior) and a new `readFullSessionPrompts()` (untruncated) both calling
  it. `sessionService.ts` exposes this as `getSessionPrompts(id)`, routed via a new
  `GET /sessions/:id/prompts` (`server/routes/sessions.ts`) — deliberately **not** folded into the
  existing `/sessions` list response, since embedding full prompt text for every session up front
  is exactly the payload bloat `MAX_PROMPT_PREVIEW_LENGTH` exists to avoid. `PromptPreviewModal.tsx`
  fetches this lazily in a `useEffect` keyed on `open`/`session.id`, guarded so it only fetches
  once per open session (not on every re-render), shows "Loading prompts…" while in flight, and
  falls back to the truncated `session.prompts` (with a small inline notice) if the fetch fails.
  Verified live against the real session that surfaced this (`088db5ed-...` in the `clientarea`
  project): the modal now shows the prompt through to "...arrume isso" instead of cutting off
  before it.

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

- **Backend** (`server/utils/claudeProjects.ts`, `readSessionUsage`): reads the _entire_
  transcript and sums `message.usage` (`input_tokens`, `output_tokens`,
  `cache_creation_input_tokens`, `cache_read_input_tokens`) per model. **Critical gotcha found
  during development**: a single API response with multiple content blocks (e.g. a `thinking`
  block followed by a `tool_use` block) is logged as multiple JSONL lines that share the same
  `message.id` and carry the _identical_ usage numbers on every line — naively summing every
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
  `"<synthetic>"` case above), then returns `totalCostUsd: null` if _any remaining_ model has
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

### Implemented: local nickname (originally shipped as "manual session rename")

**Reworked from a straight rename into a secondary label, per explicit user instruction, once a
real limitation surfaced**: after renaming a session, the user reported (with a screenshot) that
Warp's tab title for that same, still-active session still showed the old auto-derived title. Root
cause, confirmed via web research
([warpdotdev/warp#9102](https://github.com/warpdotdev/warp/issues/9102),
[warpdotdev/warp#11970](https://github.com/warpdotdev/warp/issues/11970),
[Warp Tab Configs docs](https://docs.warp.dev/terminal/windows/tab-configs/)): Warp's visible tab
title for a Claude Code session is set by Claude Code itself, as an AI agent, calling a
`set_tab_title` tool that emits an OSC 0 escape sequence — re-asserted on essentially every prompt
per the linked issues. This was **always** true, including back when this feature was still called
"rename" — the old naming just implied a real rename (of the session, its tab, everywhere) that the
implementation never actually did or could do: `renameSession()` only ever wrote to this app's own
sidecar file, never to `~/.claude/projects/` or anything Warp/Claude Code reads. There is no lever
in this codebase to change what Warp/Claude Code display — that would require changing the `claude`
CLI's own behavior, out of scope for this app. Given that, the fix was to stop pretending this is a
rename and instead show the local label *alongside* the real title, so the UI itself communicates
the limitation instead of contradicting it.
- **Storage** (`server/utils/nicknames.ts`, functions `getNicknames()`/`setNickname()` — same
  underlying file as before, `~/.claude-session-manager/custom-titles.json`, deliberately **not**
  inside `~/.claude/projects/` since that's the Claude CLI's own data and this app never writes to
  it): `{ [sessionId]: nickname }`, capped at 100 chars. A blank/whitespace-only nickname **deletes**
  the override key — no separate "clear" action needed.
- **`Session.title` is now always the real, auto-derived title — never overridden.** A new
  `Session.nickname: string | null` field carries the local override separately (both
  `server/types/session.ts` and `src/types/session.ts`). `listSessions()` (`sessionService.ts`) sets
  `nickname: nicknames[session.id] ?? null` instead of overwriting `title`.
- **Backend gate.** `setSessionNickname()` (`sessionService.ts`, was `renameSession()`) still
  re-checks `getActiveResumeSessionIds()` and throws `SessionActiveError` — mapped to **HTTP 409**
  in `server/routes/sessions.ts` (now `PATCH /:id/nickname`, body `{ nickname }`) — if the session is
  active. Unlike the original doc comment's claim, this was never actually preventing a data race
  with the CLI's own `.jsonl` writes (nicknames never touch that file) — it's kept purely for
  consistency with delete/continue/rename-turned-nickname's shared active-session gating, and
  re-verified after the rename: `curl -X PATCH .../nickname` against this session's own (active) id
  still returns `409` with the updated message ("...before changing its nickname.").
- **Frontend**: `NicknameModal.tsx` (was `RenameSessionModal.tsx`) — same pre-filled-input,
  portalled-to-`document.body`, mounted-only-while-open patterns as before (see the original
  rename-feature notes on the `react-hooks/set-state-in-effect` lint fix and the containing-block
  modal bug — both still apply verbatim). Copy now reads "Local nickname" / "Only shown in this
  app's session list, alongside the session's real title — it won't rename the session or change
  what any terminal (including Warp) shows for it."
  - `SessionCard.tsx`: the title block is now a small flex-column — `session.title` always on top,
    `session.nickname` (if set) rendered right below it in smaller italic text, so both are visible
    at once instead of one replacing the other. The pencil button's `aria-label`/tooltip switches
    between "Add local nickname" and "Edit local nickname" depending on whether one is already set;
    disabled + "Close this session in its terminal before changing its nickname." tooltip whenever
    `session.isActive`, same disabled-button-tooltip wrapper trick as Continue/Delete.
  - `useSessions.ts`: `renameSession` → `setNickname`; the `PendingAction` union's `"rename"` value
    became `"nickname"`. Search (`matchesQuery`) now checks `session.nickname ?? ""` in addition to
    `session.title`, so a session found only by its nickname still surfaces.
  - Verified live end-to-end in the browser against this very (active) session, after setting its
    nickname to "Melhorias no projeto" while it was still inactive earlier in the conversation: the
    card shows both "Adicionar filtro de range de data de last updated" (real title) and "Melhorias
    no projeto" (nickname) at once; clicking the now-disabled pencil (session active) showed the
    updated tooltip and did nothing, confirming the active-session gate survived the rework.

### Implemented: bulk select + delete

- **State** (`src/hooks/useSessions.ts`): `selectedIds: Set<string>`, `toggleSelect`,
  `clearSelection`, `selectAllOnPage`. Deliberately **not** cleared on page/filter changes — a
  session selected on page 1 stays selected after navigating to page 2 or changing a filter, so a
  bulk delete can span pages/filters. Only cleared automatically for ids that are actually
  deleted (see `removeSessions` below); "Clear" in the UI empties it explicitly.
- **`removeSessions(ids)`** — reuses the existing single-session `deleteSession` API call via
  `Promise.allSettled` (no new bulk-delete backend endpoint; a local app deleting a few dozen
  files in parallel doesn't need one) rather than adding a batch endpoint. Handles partial
  failure explicitly: a mixed success/fail result still removes the ones that succeeded from
  local state and reports a toast like "Deleted 2 sessions, 1 failed." instead of an
  all-or-nothing outcome. Marks every id `pending: "delete"` up front so each selected
  `SessionCard`'s own Delete button shows its existing spinner — no new per-card pending-state UI
  needed.
- **No active-session restriction on bulk delete at the time this feature was built** — deliberately
  consistent with the single-session delete at the time, which didn't have one either (only
  _rename_ had the active-session gate). **This has since changed** — see "active-session gate
  extended to delete, continue, and bulk selection" below; single delete, continue, and bulk
  selection all now block on `session.isActive`.
- **Frontend**: a checkbox on each `SessionCard` (top-left, next to the title, native
  `<input type="checkbox">` — this app doesn't have a custom checkbox component and one wasn't
  needed here), a selected-card highlight (ring + border color), a "Select all on this page" link
  next to the results-count line, and a selection bar (shown only when `selectedIds.size > 0`)
  with the count, "Clear", and "Delete selected" — the latter opens the _same_ `ConfirmDialog`
  component already used for single-session delete, just with a dynamic count in the message.
- Verified live with 3 disposable fake sessions created directly under `~/.claude/projects/`
  (`-tmp-bulk-delete-test-{1,2,3}/`, deleted again after testing, including the empty parent
  directories `deleteSession` leaves behind — same as single delete, this app only unlinks the
  `.jsonl` file, never removes the directory): searched for them, used "Select all on this page,"
  confirmed the bar showed "3 selected," confirmed the dialog's message showed the count
  correctly, deleted, and confirmed all three `.jsonl` files were actually gone from disk
  afterward (not just removed from the UI list).

### Implemented: active-session gate extended to delete, continue, and bulk selection

Per explicit user instruction ("se a sessão está ativa não pode executar ações em massa nem
deletar nem continuar" — if a session is active it must not be deletable, continuable, or
selectable for bulk actions), the active-session gate that previously only covered rename
(see "manual session rename" above) now covers **all four** mutating/selecting actions.

_Note: this section predates the rename → nickname rework above (`renameSession` is now
`setSessionNickname`, `PATCH /:id/title` is now `PATCH /:id/nickname`, `RenameSessionModal.tsx` is
now `NicknameModal.tsx`). Left as-is below since it's an accurate record of what changed at the
time; see "local nickname" above for the current names._

- **`SessionActiveError`** (`server/services/sessionService.ts`) generalized from a fixed
  `constructor(id: string)` message to `constructor(message: string)`, so each call site phrases
  its own action-specific message instead of one generic string.
- **Backend gates — the actual safety-relevant piece, independent of the UI.**
  `deleteSession()` and `continueSession()` (`sessionService.ts`) now both call
  `getActiveResumeSessionIds()` (same shared detector as the LED indicator and rename gate) and
  throw `SessionActiveError` if the target id is active — `deleteSession` checks it before the
  `unlink`, `continueSession` checks it before even resolving `cwd` or picking a terminal
  launcher. `server/routes/sessions.ts`'s `DELETE /:id` and `POST /:id/continue` routes both
  catch `SessionActiveError` → **HTTP 409** (mirroring the existing `PATCH /:id/title` handling).
  This is deliberately a second, independent check — the disabled button only prevents the common
  case; it can't prevent a session that became active in the gap between page load and the
  request landing. Verified directly: `curl -X DELETE .../f27322ff-...` and
  `curl -X POST .../f27322ff-.../continue` against this very session's own (genuinely active) id
  both returned `409` with the expected action-specific messages.
- **`src/services/sessionsApi.ts`** refactored so all three mutating calls (`deleteSession`,
  `continueSession`, `renameSession`) share one `withServerErrorMessage()` helper that extracts the
  server's specific `error` string from a 409/other error response and re-throws it as a plain
  `Error` (with `{ cause: err }` to satisfy the `preserve-caught-error` lint rule) — previously
  only `renameSession` did this extraction, the other two surfaced axios's generic
  "Request failed with status code 409" instead.
- **Frontend** (`src/components/SessionCard.tsx`):
  - Continue button: `continueDisabledReason` picks between the pre-existing `directoryMissing`
    tooltip and a new `"This session is already open in a terminal."` one when `session.isActive`
    — `directoryMissing` takes priority if a session were somehow both (unlikely in practice: an
    active session's directory presumably existed when it was resumed), so the tooltip always
    points at the more actionable problem. `disabled` now checks
    `isBusy || continueDisabledReason !== null`.
  - Delete button: previously had **no** tooltip wrapper at all (`disabled={isBusy}` only). Now
    pulled into its own `deleteButton` variable and wrapped in the same disabled-button-tooltip
    `<span>` trick already used for rename/continue, showing "Close this session in its terminal
    before deleting." when `session.isActive`.
  - Selection checkbox: `disabled={isBusy}` → `disabled={isBusy || session.isActive}` — an active
    session can no longer be checked for bulk actions.
  - `useSessions.ts`'s `selectAllOnPage()` now skips `session.isActive` entries when adding to the
    selection set, so "Select all on this page" doesn't try to include a session whose checkbox is
    disabled.
- Verified live in the browser against this very session's own (genuinely active) card: hovering
  Continue showed "This session is already open in a terminal.", hovering Delete showed "Close
  this session in its terminal before deleting.", and clicking the checkbox did nothing (stayed
  unchecked, no selection bar appeared) — all three confirmed disabled with correct tooltips.
