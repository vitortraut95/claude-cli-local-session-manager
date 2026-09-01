# Claude CLI Local Session Manager ->> LINUX ONLY

Local web app for managing [Claude CLI](https://claude.com/claude-code) sessions. Reads the
`*.jsonl` files `claude` writes to `~/.claude/projects` and lets you browse, resume, organize,
and clean them up. Everything runs on your machine — no external server involved.

## Features

- **Session list** — title, project, branch, last-updated/active time, and a session-size meter
  (green → amber → red)
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
- Subagent browser (per-invocation type/description/duration/result), Claude usage-limits badge
- One-click "Open in VS Code", "Open Jenkins" (for `env/*` branches), and "Open PR" buttons
- Self-update button from the header
- pt/en/es language switcher

## Prerequisites

- **Linux.** This app is Linux-only — Windows/macOS aren't supported (see the terminal-launching
  and active-session-detection notes in `CLAUDE.md` for why).
- [Node.js](https://nodejs.org/) 20+ with [Corepack](https://nodejs.org/api/corepack.html) enabled
- [Claude CLI](https://claude.com/claude-code) installed, logged in, and working from your
  terminal as the `claude` command — confirm with `claude --version` before running this app. Every
  feature here (listing sessions, resuming, "New task", etc.) either reads `~/.claude/projects`
  directly or shells out to this same `claude` binary, so if it's not on `PATH` in a fresh shell,
  nothing in this app will work either.

## Install & run

```bash
git clone https://github.com/vitortraut95/claude-cli-local-session-manager.git
cd claude-cli-local-session-manager
corepack enable
yarn install
yarn dev
```

- Frontend: http://localhost:58230
- Backend: http://localhost:58231 (Vite proxies `/sessions` to this port)

Stop the app by closing the terminal running `yarn dev`.

> Clone it wherever you like — nesting depth doesn't matter, `yarn dev` works the same from
> `~/claude-cli-local-session-manager` or `~/dev/tools/claude-cli-local-session-manager`. The one
> real rule: **don't move or rename the folder after that.** The Claude CLI ties each session to
> the exact absolute path it was started in, so moving it orphans existing sessions
> ("directory missing" in the list). If you've also run `./install-shortcut.sh` (below), its
> desktop icon/Warp config bakes in that same absolute path — if you do move the folder, just
> rerun `./install-shortcut.sh` from the new location to regenerate it.

## Desktop shortcut Linux (optional)

```bash
./install-shortcut.sh
```

Adds a **Claude Session Manager** icon to the Desktop and application menu. 

Remove code:

```bash
rm -f ~/.local/share/applications/claude-session-manager.desktop ~/Desktop/claude-session-manager.desktop
update-desktop-database ~/.local/share/applications 2>/dev/null
```

## Structure

Yarn workspaces monorepo: the root is the frontend, `server/` is the backend.

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

## Changelog

| Date       | Feature   |
| ---------- | --------- |
| 2026-09-01 | Project v1 |
