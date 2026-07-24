# Instructions for Claude

Auto-loaded at the start of every session in this repo.

## What this app is

Local web app that manages Claude CLI sessions: reads the `*.jsonl` files `claude` writes to
`~/.claude/projects`, lists them, and can resume one (`claude --resume <id>`) in a new terminal
window. Monorepo (Yarn workspaces): root = React/Vite/Tailwind frontend, `server/` = Express
backend. See `README.md` for setup/run instructions.

**Primary support: Linux.** Windows/macOS have code paths but are not smoke-tested on real
hardware — see "Cross-platform caveats" below.

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
  `getActiveResumeSessionIds()` (active-session detection, `sessionService.ts`) uses `ps -eo args=`
  and is Linux/macOS only — returns an empty set on `win32` for the same reason (no verified
  Windows equivalent).
- `open-terminal.sh` (used by the GNOME desktop shortcut) duplicates the terminal-picking logic in
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
