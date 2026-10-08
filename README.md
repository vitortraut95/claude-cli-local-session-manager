# Claude CLI Local Session Manager ->> LINUX ONLY

Local web app for managing [Claude CLI](https://claude.com/claude-code) sessions. Reads the
`*.jsonl` files `claude` writes to `~/.claude/projects` and lets you browse, resume, organize,
and clean them up. Everything runs on your machine — no external server involved.

## Features

- **Session list** — title, project, branch, last-updated/active time, and a session-size meter
  (green → amber → red)
- **Resume** any session in a new terminal (`claude --resume`), Warp preferred if installed
- **New task** — paste a Jira link + instructions, pick a project, and it opens a terminal
  already running Claude with that prompt — optionally in an isolated git worktree
- **New session** — the lightweight version: pick a project, the team skills and a prompt (its own
  default, separate from New task's) and Claude starts right in the project folder — no Jira link,
  branch or worktree; it only asks for confirmation if a session is already active there
- **Team skills** — optional integration with your team's own skills repo (a git repo with a
  `catalog/<catalog>/` tree of skills; its URL is asked on first start and kept only in your local
  `userPreferences.json`): the New task/New session modals invite you to clone it, you pick whole catalogs and/or single skills, and
  their skills get linked into `~/.claude/skills`; "Update now" (never automatic) fetches/
  fast-forwards the hub and links new skills (Settings → "Team skills" to manage)
- **Worktree → root** — copy a worktree's files into the project root to test locally, or move
  the branch there for real once it's ready to push
- Full-text search across every prompt, plus project/date filters
- Local nicknames, bulk delete, active-session protection (won't let two terminals fight over
  the same session)
- Subagent browser (per-invocation type/description/duration/result), Claude usage-limits badge
- One-click "Open in VS Code", Jenkins links (project, branch and ticket variants, PRs, tags,
  optional per-project `env/*` preview links), and "Open PR" buttons — the Jenkins URL and preview
  templates are per-machine settings (asked on first start / Settings), never part of this repo
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
| GET    | `/sessions/:id/export`         | Download the session as a `.claude-session.json.gz` file |
| POST   | `/sessions/import/inspect`     | Read an exported file (raw body) and list local target clones |
| POST   | `/sessions/import`             | Import an exported file into `?targetDir=` (optional `&checkoutBranch=true`) |
| GET    | `/tasks/skills-hub/status`     | Team skills: hub location/branch, catalogs, link state per skill |
| GET    | `/tasks/skills-hub/skill`      | One hub skill's SKILL.md content (`?catalog=&name=`) |
| POST   | `/tasks/skills-hub/sync`       | Fetch + fast-forward the hub (when clean) and link new skills |
| POST   | `/tasks/skills-hub/clone`      | Clone the configured hub repo into `{ parentDir }` |
| GET    | `/tasks/skills-hub/detected-repo-url` | `origin` of a hub clone already on this machine (prompt prefill) |
| PUT    | `/tasks/skills-hub/repo-url`   | Save the hub's clone URL `{ repoUrl }` (`""` = not used) |
| PUT    | `/tasks/skills-hub/selection`  | Save `{ catalogs, skills }` (whole catalogs + single skills) and (un)link them |
| PUT    | `/tasks/skills-hub/path`       | Point at an existing clone (`null` = auto-detect) |
| PUT    | `/tasks/skills-hub/flags`      | `{ inviteDismissed? }` |

## Changelog

| Date       | Feature   |
| ---------- | --------- |
| 2026-09-01 | Project v1 |
