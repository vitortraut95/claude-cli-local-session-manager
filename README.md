# Claude CLI Local Session Manager

Local web app for managing [Claude CLI](https://claude.com/claude-code) sessions. Reads the
`*.jsonl` files `claude` writes to `~/.claude/projects`, lists them, and lets you resume, delete,
search, or nickname them. Everything runs on your machine — no external server involved.

**Primary support: Linux.** Experimental (not smoke-tested) Windows/macOS launch scripts are
included — see below.

## Features

- List all sessions with title, project, last-updated time, and estimated token cost
- Resume a session in a new terminal (`claude --resume <id>`), Warp preferred if installed
- Delete sessions individually or in bulk
- Full-text search across every prompt in a session
- Local nicknames (shown alongside the real session title, doesn't rename anything Claude/Warp show)
- Active-session indicator, with delete/continue/bulk-select blocked while a session is in use
- Warning badge when a session's original working directory no longer exists

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

Yarn workspaces monorepo: the root is the frontend, `server/` is the backend.

## API

| Method | Route                     | Description                                   |
| ------ | ------------------------- | ---------------------------------------------- |
| GET    | `/sessions`               | List every session found in `~/.claude/projects` |
| GET    | `/sessions/:id/prompts`   | Full, untruncated list of prompts for a session |
| PATCH  | `/sessions/:id/nickname`  | Set or clear a session's local nickname       |
| DELETE | `/sessions/:id`           | Delete the session's `.jsonl` file            |
| POST   | `/sessions/:id/continue`  | Open a terminal running `claude --resume <id>` |

## Scripts

- `yarn dev` — start frontend and backend together
- `yarn build` — production build for both workspaces
- `yarn lint` — lint frontend and backend
- `yarn typecheck` — type-check both workspaces
- `yarn preview` — serve the frontend production build
