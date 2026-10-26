#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FRONTEND_PORT=58230
BACKEND_PORT=58231
URL="http://localhost:$FRONTEND_PORT"

is_port_open() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
  local result=$?
  exec 3<&- 2>/dev/null
  exec 3>&- 2>/dev/null
  return $result
}

frontend_up=false
backend_up=false
is_port_open "$FRONTEND_PORT" && frontend_up=true
is_port_open "$BACKEND_PORT" && backend_up=true

# Both already running: just open a browser tab.
if $frontend_up && $backend_up; then
  nohup xdg-open "$URL" >/dev/null 2>&1 &
  disown
  exit 0
fi

# Exactly one side up = an orphan from a partial shutdown; kill both ports before starting a
# fresh `yarn dev`.
if $frontend_up || $backend_up; then
  fuser -k -n tcp "$FRONTEND_PORT" >/dev/null 2>&1 || true
  fuser -k -n tcp "$BACKEND_PORT" >/dev/null 2>&1 || true
  sleep 1
fi

# Warp has no flag to run a command on launch: write a Tab Config TOML and open it via
# `warp://tab_config/<name>`. No `?new_window=true` — it opens a second window when Warp isn't
# running yet.
if command -v warp-terminal >/dev/null 2>&1; then
  TABCFG_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/warp-terminal/tab_configs"
  mkdir -p "$TABCFG_DIR"
  NAME="claude-session-manager-$(date +%s)"
  {
    echo "name = \"$NAME\""
    echo
    echo "[[panes]]"
    echo "id = \"main\""
    echo "type = \"terminal\""
    echo "directory = \"$PROJECT_DIR\""
    echo "commands = [\"$PROJECT_DIR/start.sh\"]"
  } >"$TABCFG_DIR/$NAME.toml"
  exec xdg-open "warp://tab_config/$NAME"
fi

# Opens start.sh in the first emulator found (the .desktop's `Terminal=true` sometimes does
# nothing from the GNOME dock). Must match session/terminal.ts's TERMINAL_LAUNCHERS — checked by
# `yarn lint` (scripts/check-terminal-launchers-sync.mjs).
TERMINAL_LAUNCHERS=(x-terminal-emulator gnome-terminal konsole xfce4-terminal xterm)

# `read` keeps the window open after `yarn dev` exits, so its output stays readable.
SHELL_CMD="'$PROJECT_DIR/start.sh'; echo; read -p 'Press Enter to close...' _"

for bin in "${TERMINAL_LAUNCHERS[@]}"; do
  if command -v "$bin" >/dev/null 2>&1; then
    # Each emulator's "run this command" flag differs; matches session/terminal.ts.
    case "$bin" in
      gnome-terminal) exec "$bin" -- bash -c "$SHELL_CMD" ;;
      xfce4-terminal) exec "$bin" -x bash -c "$SHELL_CMD" ;;
      *) exec "$bin" -e bash -c "$SHELL_CMD" ;;
    esac
  fi
done

echo "No terminal emulator found (tried: ${TERMINAL_LAUNCHERS[*]})." >&2
exit 1
