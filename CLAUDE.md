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
   immediately when `process.platform !== "linux"`, so `useWarp` silently falls through to the
   plain-terminal branch above on Mac/Windows. Reasoning: a wrong guessed path wouldn't error, it'd
   silently write the tab-config TOML to a folder Warp never looks at — Warp would open, but
   ignore the resume command, which is a more confusing failure than just not offering Warp there.
   `WARP_DATA_DIR` env var override still exists (see above) as the escape hatch once someone
   confirms the real per-OS defaults and wants to wire this back up (macOS is probably somewhere
   under `~/Library/Application Support/dev.warp.Warp-Stable/`, Windows under `%APPDATA%\Warp\` —
   **both still guesses, not verified**).
3. **Desktop-shortcut installer is 100% Linux/GNOME-specific and not portable as-is**:
   `install-shortcut.sh`, `open-terminal.sh`, `start.sh`, `claude-session-manager.desktop.template`.
   Uses `.desktop` file format, `xdg-user-dir`, `gio set ... metadata::trusted`,
   `update-desktop-database`, a Bash-only `/dev/tcp/...` port probe (`open-terminal.sh:9`), and
   `chmod +x` (meaningless on Windows). **Recommendation: don't try to port this — build separate,
   clearly-labeled installers per OS** (Windows: a `.lnk` via a small script, or a `.url` file;
   macOS: a minimal `.app` bundle or an Automator/Shortcuts workflow) rather than sharing code
   across three very different shortcut mechanisms.

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
- **`warp-terminal` and `gnome-terminal` are both installed on this dev machine**; Warp is the
  default terminal choice (`src/hooks/useWarpPreference.ts`, `getWarpPreference()` defaults to
  `true`/Warp when the user hasn't chosen).

### Suggested order of attack, when this work actually starts

1. **Smoke-test the new macOS/Windows terminal launchers on real machines.** This is now the
   single highest-priority item — the code exists (`launchMacTerminal`/`launchWindowsTerminal` in
   `sessionService.ts`) but is completely unverified. Needs someone with an actual Mac and Windows
   box to click "Continue (terminal)" and confirm: does Terminal.app/Windows Terminal actually
   open, in the right directory, running the right command; does it come to focus or have the
   same focus-stealing issue Linux/Wayland has (see decisions below — worth re-checking whether
   macOS/Windows are more permissive here before assuming the in-app toast is the only option
   there too).
2. Confirm real Warp data-dir paths for macOS/Windows (needs someone with those machines, or the
   Warp docs/support to confirm), then wire `launchWarp()` back up for those platforms (currently
   hard-disabled off Linux — see above).
3. Decide whether the desktop-shortcut feature is worth building per-OS installers for at all, or
   whether it stays a Linux-only convenience script — this is a product call, not just an
   engineering one.
4. Retire the duplicate logic in `open-terminal.sh` (still Linux-only, wasn't touched by #1) once
   there's a reason to make the desktop shortcut cross-platform too — a drift *guard*
   (`scripts/check-terminal-launchers-sync.mjs`, wired into `yarn lint`) exists now, but the two
   implementations are still separate; true unification is blocked on solving the
   Node-not-on-PATH cold-bootstrap problem first (see above).
