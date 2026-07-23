# Claude Session Manager

## IMPORTANT: TODAY ONLY IMPLEMENTED TO WORK ON UBUNTU

Local manager for [Claude CLI](https://claude.com/claude-code) sessions. Reads the `*.jsonl`
files that `claude` writes to `~/.claude/projects` directly, with no external server involved —
everything runs on your machine.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4 + Axios
- **Backend:** Express + TypeScript + Node.js

## Prerequisites

- Linux with a GNOME environment
- [Node.js](https://nodejs.org/) 20+ and npm
- [Claude CLI](https://claude.com/claude-code) installed and available on `PATH` (the `claude` command)

## Installation

```bash
git clone https://github.com/vitortraut95/claude-cli-local-session-manager.git
cd claude-cli-local-session-manager
npm install
```

## Running it

```bash
npm run dev
```

- Frontend: http://localhost:58230
- Backend: http://localhost:58231 (Vite proxies `/sessions` and `/system` to this port)

To stop everything, use the **"Stop application"** button in the header, or close the terminal.

## GNOME shortcut (optional)

```bash
./install-shortcut.sh
```

Creates the **Claude Session Manager** icon on the Desktop and in the application menu, pointing
at the project's current folder. Clicking that icon:

- **if the app is already running:** just opens `http://localhost:58230` in a browser tab.
- **if it's not running:** opens a terminal and starts the app (`start.sh` → `npm run dev`).

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

## Structure

```
/
├── install-shortcut.sh    # generates and installs the GNOME shortcut
├── open-terminal.sh       # what the shortcut runs: opens a tab if already running,
│                          # otherwise opens a terminal and calls start.sh
├── start.sh               # runs inside the terminal: cd into the project + npm run dev
├── server/                # Express API
└── src/                   # React SPA (workspace root, "web")
```

This repository is a monorepo using [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces):
the root is the web app itself, and `server/` is the second workspace.

## API

| Method | Route                    | Description                                                |
| ------ | ------------------------ | ------------------------------------------------------------ |
| GET    | `/sessions`              | Lists every session found in `~/.claude/projects`             |
| DELETE | `/sessions/:id`          | Deletes the session's `.jsonl` file                           |
| POST   | `/sessions/:id/continue` | Opens a terminal running `claude --resume <id>`               |
| POST   | `/system/shutdown`       | Stops frontend and backend (used by the "Stop application" button) |

## Scripts

- `npm run dev` — starts frontend and backend together
- `npm run build` — production build for both workspaces
- `npm run lint` — ESLint for frontend and backend
- `npm run preview` — serves the frontend production build
