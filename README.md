# Claude CLI Local Session Manager ->> LINUX ONLY

Local web app for managing [Claude CLI](https://claude.com/claude-code) sessions. Reads the
`*.jsonl` files `claude` writes to `~/.claude/projects` and lets you browse, resume, organize,
and clean them up. Everything runs on your machine — no external server involved.

## Features

- **Session list** — title, project, branch, last-updated/active time, and a session-size meter
  (green → amber → red)
- **Resume** any session in a new terminal (`claude --resume`), Warp preferred if installed
- **Grid layout** — optional (Settings → "Where sessions open"): every session the app opens (New
  task, the queue, New session, Resume) becomes a pane of one [Limux](https://github.com/am-will/limux)
  workspace, "Claude — tarefas", in its own window, instead of a tab of its own; a pane closes when
  Claude quits, and "Resume" on a session already there focuses its pane. Needs Limux 0.1.33+;
  closing the Limux window ends the sessions in it (they stay resumable). Reopened, Limux restores
  its panes as empty shells: "Open grid" resumes each session into the idle pane of a tab named
  after its task (one dragged out of the grid), else an idle grid pane, and closes the grid's
  leftover empty panes
- **Preview URLs** — each card lists the local URLs serving its folder and its task's worktrees,
  found with no config: docker dev-server containers (declaring PORT / BASE_URL / `-p`, tied by
  their bind mounts or compose dir — e.g. a worktree's own `mainsite<country>-<task>` container)
  and processes listening from inside the folder. A task worktree's container can be stopped
  (frees its memory, stays on the card), started again or removed from the card; otherwise it keeps
  running until the task is marked done, which removes it
- **History** — every step of the task flow is appended to the local, gitignored `history.jsonl`
  (one JSON event per line: queue added/updated/removed/retried, scheduler blocked/unblocked and
  why, launch started/launched/failed with durations, status changes and who made them, root
  locked/released/refused, cleanup, sessions started/resumed, heavy-run waits/timeouts/previews/
  durations/exit codes and hook blocks), to measure where time goes and track errors. A card with events tied to its
  session or task shows an "info" button next to its status tag: a summary (time in line and what
  held it, time per status, until done, heavy runs and their waits, root held/refused) plus the
  task's timeline and problems
- **Resume open tasks** — one header button brings back the latest session of every task "in
  progress" or "waiting user" with nothing running (up to the session limit), e.g. the next
  morning; with the grid layout it's "Open grid", which also brings Limux up (starting it if
  needed)
- **New task** — paste a Jira link + instructions, pick a project, and it opens a terminal
  already running Claude with that prompt — optionally in an isolated git worktree
- **New session** — the lightweight version: pick a project, the team skills and a prompt (its own
  default, separate from New task's) and Claude starts right in the project folder — no Jira link,
  branch or worktree; it only asks for confirmation if a session is already active there
- **Team skills** — optional integration with your team's own skills repo (a git repo with a
  `catalog/<catalog>/` tree of skills; its URL is asked on first start and kept only in your local
  `userPreferences.json`): the New task/New session modals invite you to clone it, you pick whole catalogs and/or single skills, and
  their skills get linked into `~/.claude/skills`; the hub is fast-forwarded on server start (when
  clean) and on "Update now", which also links new skills (Settings → "Team skills" to manage)
- **Task queue** — paste a list of tickets (links or keys) that are ready to be worked on and pick
  the repo(s) of each one (the first is the main repo). A scheduler then launches them on its own,
  each exactly like "New task" (task branch off the repo's default, its own worktree, the default
  prompt, a new terminal), one at a time while there's room: at most N live `claude` sessions
  (default 6, every session counts), at least 5 min since the last launch (a session's memory
  shows up minutes after it opens), enough free RAM, no memory pressure (PSI) and Claude plan
  usage under a limit. Pause/resume and the limits live in the queue window; a launched task gets
  the "in progress" status. Kept in the local `tasks.json`
- **Heavy commands** — optional (Task queue window → "Turn on"): a PreToolUse hook in
  `~/.claude/settings.json` blocks tests, typecheck, lint, builds and `git commit` (its pre-commit
  hooks) run directly and has Claude rerun them through `scripts/heavy-run`, which waits for a
  free slot across every session (default 1 at a time) and for that much free RAM, runs each one
  in its own cgroup with a RAM/CPU cap (`systemd-run --user --scope`) at low CPU/IO priority, and
  caps Node's heap at ~85% of the RAM cap — so a runaway run fails alone (137 = RAM cap, 134 =
  heap cap) instead of freezing the machine. Dev-server containers (`docker run … next dev`,
  `yarn dev`, vite, storybook) are blocked too and started as `heavy-run --preview docker run …`:
  at most N previews at once across sessions (default 5, counted by a container label), each with
  a RAM cap (default 4 GB) and 2 CPUs. Each task keeps one preview running for you to validate
  its worktree. A run or preview that waits over 15 min gives up (exit 75,
  nothing ran) instead of hanging the session
- **Task worktree setup** — per repo (Settings → "Task worktree setup"), a new task worktree gets
  a symlink to each of the main checkout's `node_modules` (root and workspaces) and a copy of its
  gitignored `.env*` files, since git only checks out tracked files. The link is added to the repo's
  `info/exclude` (a `node_modules/` ignore line doesn't match a symlink) and the session is told not
  to install there
- **Multi-repo tasks** — a task (ticket key, e.g. `PROJ-123`) can span several repos: New task can
  create the same branch in extra repos (they join the one session via `--add-dir`), a card's "+"
  adds another repo later (then paste the `/add-dir` it shows), and each card shows the task's
  other repos. Everything is kept in the local `tasks.json`
- **Work status** — an editable tag on each card (to do, in progress, waiting user, done) to pick
  sessions back up another day; a task's status is shared by all its sessions (a session with no
  task keeps its own), and the list can be filtered by it ("not done" = what's left to resume)
  — marking a worktree's card "done" offers to remove that worktree once it's safe (no pending
  changes, session closed, every commit on origin); only the folder goes, the branch stays until
  merged. Cleanup lists the same for every done task (extra repos of a task included)
- Full-text search across every prompt (also matches a session's task key), plus a project filter
- Local nicknames, bulk delete, active-session protection (won't let two terminals fight over
  the same session)
- Claude usage-limits badge
- One-click "Open in VS Code", Jenkins links (project, branch and ticket variants, PRs, tags,
  optional per-project `env/*` preview links), and "Open PR" buttons — the Jenkins URL and preview
  templates are per-machine settings (asked on first start / Settings), never part of this repo
- Initial setup on first start (repo folders, Jenkins URL, team skills repo) and full settings
  export/import in Settings — share a `userPreferences.json` with your team to set everything up
- Self-update button from the header
- pt/en language switcher

## Prerequisites

- **Linux.** Windows/macOS aren't supported.
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

| Method | Route                                 | Description                                                                    |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/sessions`                           | List every session found in `~/.claude/projects`                               |
| GET    | `/sessions/:id/prompts`               | Full, untruncated list of prompts for a session                                |
| PATCH  | `/sessions/:id/nickname`              | Set or clear a session's local nickname                                        |
| PATCH  | `/sessions/:id/branches`              | Set or clear a session's saved origin/destination branches                     |
| PATCH  | `/sessions/:id/status`                | Set or clear (`null`) the work status of a session with no task                |
| DELETE | `/sessions/:id`                       | Delete the session's `.jsonl` file                                             |
| POST   | `/sessions/:id/continue`              | Open a terminal running `claude --resume <id>`                                 |
| POST   | `/sessions/:id/vscode`                | Open the session's working directory in VS Code                                |
| POST   | `/sessions/resume-open`               | Resume the latest session of every in-progress / waiting task not running      |
| GET    | `/sessions/:id/history`               | The session's (and its task's) history events and their summary                |
| POST   | `/sessions/:id/grid-focus`            | Focus the Limux grid pane already running the session (`{ focused }`)          |
| GET    | `/sessions/:id/export`                | Download the session as a `.claude-session.json.gz` file                       |
| GET    | `/sessions/:id/task`                  | The session's task (key, inferred or saved) and that task's repos              |
| PUT    | `/sessions/:id/task`                  | Save `{ taskKey, link? }` on the session (`""` = back to detecting it)         |
| POST   | `/sessions/import/inspect`            | Read an exported file (raw body) and list local target clones                  |
| POST   | `/sessions/import`                    | Import an exported file into `?targetDir=` (optional `&checkoutBranch=true`)   |
| POST   | `/tasks/preferences/import`           | Replace every setting with an imported `userPreferences.json`                  |
| GET    | `/tasks/by-key/:key`                  | A task's link, repos (branch, base, folder) and sessions                       |
| PUT    | `/tasks/by-key/:key`                  | Save the task's `{ link }`                                                     |
| PUT    | `/tasks/by-key/:key/status`           | Set or clear (`null`) the task's work status `{ status }`                      |
| POST   | `/tasks/by-key/:key/repos`            | Create the task's branch in another repo `{ folderPath, branchName?, ... }`    |
| DELETE | `/tasks/by-key/:key/repos`            | Unlink `{ repoRoot, branch }` from the task (branch and worktree stay)         |
| GET    | `/tasks/by-key/:key/pr-url`           | "Open PR" link for one of the task's repos (`?repoRoot=&branch=&base=`)        |
| GET    | `/tasks/queue`                        | The task queue: `{ key, link, repos, addedAt }[]` (first repo = main)          |
| PUT    | `/tasks/queue`                        | Replace the queue `{ entries: { key, link?, repos }[] }` (repos → repo roots)  |
| GET    | `/tasks/queue/status`                 | Scheduler state: live sessions, free RAM, plan usage, what it's waiting on     |
| POST   | `/tasks/queue/run`                    | Run a scheduler check now (launches the next ready task if there's room)       |
| GET    | `/tasks/heavy-run/hook`               | Whether the heavy-tests hook is in `~/.claude/settings.json`                   |
| PUT    | `/tasks/heavy-run/hook`               | Install/remove it `{ installed }` (only that hook's entry is touched)          |
| POST   | `/system/previews/:id/stop`           | Stop a task worktree's preview (container stopped / process ended)             |
| POST   | `/system/previews/:id/start`          | Start a task worktree's stopped preview container again (409 at the limit)     |
| POST   | `/system/previews/:id/remove`         | Remove a task worktree's preview container                                     |
| GET    | `/system/terminal-grid`               | The Limux grid: Limux installed, running, pane count                           |
| POST   | `/system/terminal-grid/open`          | Bring Limux up and resume every open task into the grid                        |
| GET    | `/cleanup/worktree-for-session/:id`   | What removing a session's worktree would mean now (finding, or why not)        |
| POST   | `/tasks/test-task`                    | Open a terminal running `/<taskTestSkill> <ticketLink>` ("Test task" button)   |
| GET    | `/tasks/skills-hub/status`            | Team skills: hub location/branch, catalogs, link state per skill               |
| GET    | `/tasks/skills-hub/skill`             | One hub skill's SKILL.md content (`?catalog=&name=`)                           |
| POST   | `/tasks/skills-hub/sync`              | Fetch + fast-forward the hub (when clean) and link new skills                  |
| POST   | `/tasks/skills-hub/clone`             | Clone the configured hub repo into `{ parentDir }`                             |
| GET    | `/tasks/skills-hub/detected-repo-url` | `origin` of a hub clone already on this machine (prompt prefill)               |
| PUT    | `/tasks/skills-hub/repo-url`          | Save the hub's clone URL `{ repoUrl }` (`""` = not used)                       |
| PUT    | `/tasks/skills-hub/selection`         | Save `{ catalogs, skills }` (whole catalogs + single skills) and (un)link them |
| PUT    | `/tasks/skills-hub/path`              | Point at an existing clone (`null` = auto-detect)                              |
