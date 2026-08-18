# Claude CLI Local Session Manager

Local web app for managing [Claude CLI](https://claude.com/claude-code) sessions. Reads the
`*.jsonl` files `claude` writes to `~/.claude/projects` and lets you browse, resume, organize,
and clean them up. Everything runs on your machine — no external server involved.

**Primary support: Linux.** Experimental (not smoke-tested) Windows/macOS launch scripts are
included — see below.

## Features

- **Session list** — title, project, branch, last-updated/active time, estimated token cost, and
  a session-size meter (green → amber → red)
- **Resume** any session in a new terminal (`claude --resume`), Warp preferred if installed
- **Compact & continue** — when a session's `.jsonl` gets large, draft a summary (editable) and
  start a fresh, lighter session in the same folder, linked back to the original
- **New task** — paste a Jira link + instructions, pick a project, and it opens a terminal
  already running Claude with that prompt — optionally in an isolated git worktree
- **Worktree → root** — copy a worktree's files into the project root to test locally, or move
  the branch there for real once it's ready to push
- Full-text search across every prompt, plus project/date filters
- Local nicknames, bulk delete, active-session protection (won't let two terminals fight over
  the same session)
- Subagent cost breakdown, insights panel (token-saving tips), Claude usage-limits badge
- One-click "Open in VS Code", "Open Jenkins" (for `env/*` branches), and "Open PR" buttons
- Self-update button (`git pull` + rebuild) from the header
- pt/en/es language switcher

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ with [Corepack](https://nodejs.org/api/corepack.html) enabled
- [Claude CLI](https://claude.com/claude-code) installed and on `PATH` (the `claude` command)

## Install & run

```bash
cd ~
git clone https://github.com/vitortraut95/claude-cli-local-session-manager.git
cd claude-cli-local-session-manager
corepack enable
yarn install
yarn dev
```

- Frontend: http://localhost:58230
- Backend: http://localhost:58231 (Vite proxies `/sessions` to this port)

Stop the app by closing the terminal running `yarn dev`.

> Clone directly under your home directory, not nested inside another folder — the Claude CLI
> ties each session to the exact path it was started in, and the desktop shortcut below opens a
> terminal at the project's current path. Moving the folder later breaks both.

## Desktop shortcut (optional)

### Linux (GNOME)

```bash
./install-shortcut.sh
```

Adds a **Claude Session Manager** icon to the Desktop and application menu. Clicking it opens the
app in a browser if it's already running, or starts it (in Warp if installed, otherwise the first
terminal emulator found) if not.

Remove it with:

```bash
rm -f ~/.local/share/applications/claude-session-manager.desktop ~/Desktop/claude-session-manager.desktop
update-desktop-database ~/.local/share/applications 2>/dev/null
```

### Windows (experimental)

Double-click `start-windows.bat` to start the app. To add a Desktop shortcut, open PowerShell
inside the project folder and run:

```powershell
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut("$env:USERPROFILE\Desktop\Claude Session Manager.lnk")
$s.TargetPath = "$PWD\start-windows.bat"
$s.WorkingDirectory = "$PWD"
$s.IconLocation = "$env:SystemRoot\System32\shell32.dll,137"
$s.Save()
```

### macOS (experimental)

Double-click `start-mac.command` to start the app. To add a Desktop shortcut, open Terminal
inside the project folder and run:

```bash
ln -sf "$PWD/start-mac.command" ~/Desktop/"Claude Session Manager.command"
```

## Structure

```
/
├── install-shortcut.sh    # generates and installs the GNOME shortcut
├── open-terminal.sh       # opens a browser tab if already running, else a terminal + start.sh
├── start.sh               # runs inside the terminal: cd into the project + yarn dev
├── start-windows.bat      # Windows equivalent
├── start-mac.command      # macOS equivalent
├── server/                # Express API
└── src/                   # React SPA (workspace root)
```

Yarn workspaces monorepo: the root is the frontend, `server/` is the backend. See `CLAUDE.md` for
the full architecture/API surface and the "why" behind non-obvious decisions.

## API

| Method | Route                          | Description                                       |
| ------ | ------------------------------ | -------------------------------------------------- |
| GET    | `/sessions`                    | List every session found in `~/.claude/projects`  |
| GET    | `/sessions/:id/prompts`        | Full, untruncated list of prompts for a session   |
| PATCH  | `/sessions/:id/nickname`       | Set or clear a session's local nickname           |
| DELETE | `/sessions/:id`                | Delete the session's `.jsonl` file                |
| POST   | `/sessions/:id/continue`       | Open a terminal running `claude --resume <id>`    |
| POST   | `/sessions/:id/vscode`         | Open the session's working directory in VS Code  |
| POST   | `/sessions/:id/compact-summary`  | Draft a summary for "Compact & continue"        |
| POST   | `/sessions/:id/compact-continue` | Launch the lighter pt2 session from that draft  |

## Scripts

- `yarn dev` — start frontend and backend together
- `yarn build` — production build for both workspaces
- `yarn lint` — lint frontend and backend
- `yarn typecheck` — type-check both workspaces
- `yarn preview` — serve the frontend production build

## Changelog

Newest first — one line per notable feature, not every commit.

| Date       | Feature                                                                 |
| ---------- | ------------------------------------------------------------------------ |
| 2026-08-18 | "Compact & continue" — summarize a large session into a lighter pt2, linked badges |
| 2026-08-13 | "Open Jenkins" / "Open PR" buttons on session cards                     |
| 2026-08-07 | Worktree flow hardening (active-session copy mode, orphaned-worktree recovery) |
| 2026-08-04 | Onboarding modal + pt/en/es language switcher                           |
| 2026-07-30 | Git worktree support, "New Task" modal, Claude usage-limits badge       |
| 2026-07-29 | "Open in VS Code" button                                                |
| 2026-07-27 | Session-size meter, insights panel, subagent cost breakdown             |
| 2026-07-24 | Active/inactive indicator, token cost, bulk delete, prompt preview      |
| 2026-07-23 | First version — list, resume, delete, search, nicknames, theme toggle   |
