# Claude CLI Local Session Manager - Ubuntu

## IMPORTANT: TODAY ONLY IMPLEMENTED TO WORK ON UBUNTU

Local manager for [Claude CLI](https://claude.com/claude-code) sessions. Reads the `*.jsonl`
files that `claude` writes to `~/.claude/projects` directly, with no external server involved —
everything runs on your machine.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4 + Axios
- **Backend:** Express + TypeScript + Node.js

## Prerequisites

- Linux (with a GNOME environment for shortcuts to work - optional). Windows and macOS also have
  experimental, not-yet-verified paths — see [Windows shortcut](#windows-shortcut-experimental-optional)
  and [macOS shortcut](#macos-shortcut-experimental-optional) below.
- [Node.js](https://nodejs.org/) 20+ with [Corepack](https://nodejs.org/api/corepack.html) enabled (`corepack enable`) for Yarn
- [Claude CLI](https://claude.com/claude-code) installed and available on `PATH` (the `claude` command)

## Installation

**Clone it directly under your home directory** (not nested inside `git/`, `projects/`, or any
other subfolder). The Claude CLI ties each session to the exact folder it was started in, and the
one-click shortcut opens a terminal at the project's current path — moving the folder later breaks
both, so picking one stable, top-level location up front avoids that entirely.

```bash
cd ~
git clone https://github.com/vitortraut95/claude-cli-local-session-manager.git
cd claude-cli-local-session-manager
yarn install
```

## Running it

```bash
yarn dev
```

- Frontend: http://localhost:58230
- Backend: http://localhost:58231 (Vite proxies `/sessions` and `/system` to this port)

To stop everything, close the terminal running `yarn dev`.

## GNOME shortcut (optional)

```bash
./install-shortcut.sh
```

Creates the **Claude Session Manager** icon on the Desktop and in the application menu, pointing
at the project's current folder. Clicking that icon:

- **if the app is already running:** just opens `http://localhost:58230` in a browser tab.
- **if it's not running:** starts the app (`start.sh` → `yarn dev`) in [Warp](https://www.warp.dev/)
  if it's installed, otherwise in the first terminal emulator found on your system.

If you move the project folder, run `./install-shortcut.sh` again from inside it to regenerate
the shortcut with the new path.

### Removing the shortcut

```bash
rm -f ~/.local/share/applications/claude-session-manager.desktop
rm -f ~/Desktop/claude-session-manager.desktop
update-desktop-database ~/.local/share/applications 2>/dev/null
```

If the icon is also pinned to the dock, right-click it and choose **"Unpin"** / **"Remove from
Favorites"**.

## Windows shortcut (experimental, optional)

> **Not smoke-tested on a real Windows machine yet** — this repo's development happens on Linux.
> The logic is straightforward (check if the port answers, otherwise run `yarn dev`), but please
> report back if something doesn't behave as expected.

Double-click **`start-windows.bat`** (in the project root) to start the app — it opens a console
window, checks whether the frontend is already running (opens a browser tab if so), otherwise
runs `yarn dev` and keeps the window open so you can read the output.

To put a shortcut to it on your Desktop, open PowerShell **from inside the cloned project
folder** and run:

```powershell
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut("$env:USERPROFILE\Desktop\Claude Session Manager.lnk")
$s.TargetPath = "$PWD\start-windows.bat"
$s.WorkingDirectory = "$PWD"
$s.IconLocation = "$env:SystemRoot\System32\shell32.dll,137"
$s.Save()
```

(Pasting commands directly into PowerShell like this runs regardless of script execution
policy — that restriction only applies to running a saved `.ps1` file.)

If you move the project folder, delete the shortcut and re-run the command above from the new
location.

## macOS shortcut (experimental, optional)

> **Not smoke-tested on a real Mac yet** — this repo's development happens on Linux. Same
> disclaimer as Windows above: please report back if something doesn't behave as expected.

Double-click **`start-mac.command`** (in the project root) — macOS opens it in Terminal.app on
its own (no terminal-picking logic needed here, unlike the Linux/Windows scripts). It checks
whether the frontend is already running (opens a browser tab if so), otherwise runs `yarn dev`
and keeps the window open so you can read the output.

To put a shortcut to it on your Desktop, open Terminal **from inside the cloned project folder**
and run:

```bash
ln -sf "$PWD/start-mac.command" ~/Desktop/"Claude Session Manager.command"
```

This makes a symlink, not an `osascript`/Finder-scripting alias, so it doesn't trigger macOS's
Automation permission prompt — Finder follows it transparently, so double-clicking the Desktop
icon runs `start-mac.command` wherever the project actually lives.

If you move the project folder, re-run the command above from the new location (`-f` overwrites
the old symlink).

## Structure

```
/
├── install-shortcut.sh    # generates and installs the GNOME shortcut
├── open-terminal.sh       # what the shortcut runs: opens a tab if already running,
│                          # otherwise opens a terminal and calls start.sh
├── start.sh               # runs inside the terminal: cd into the project + yarn dev
├── start-windows.bat      # Windows equivalent of open-terminal.sh + start.sh combined
├── start-mac.command      # macOS equivalent (double-clickable, opens in Terminal.app itself)
├── server/                # Express API
└── src/                   # React SPA (workspace root, "web")
```

This repository is a monorepo using [Yarn workspaces](https://yarnpkg.com/features/workspaces):
the root is the web app itself, and `server/` is the second workspace.

## API

| Method | Route                    | Description                                       |
| ------ | ------------------------ | -------------------------------------------------- |
| GET    | `/sessions`              | Lists every session found in `~/.claude/projects` |
| DELETE | `/sessions/:id`          | Deletes the session's `.jsonl` file               |
| POST   | `/sessions/:id/continue` | Opens a terminal running `claude --resume <id>`   |

## Scripts

- `yarn dev` — starts frontend and backend together
- `yarn build` — production build for both workspaces
- `yarn lint` — ESLint for frontend and backend
- `yarn preview` — serves the frontend production build
