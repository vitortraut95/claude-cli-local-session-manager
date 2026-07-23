#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FRONTEND_PORT=58230
URL="http://localhost:$FRONTEND_PORT"

is_frontend_running() {
  (exec 3<>"/dev/tcp/127.0.0.1/$FRONTEND_PORT") 2>/dev/null
  local result=$?
  exec 3<&- 2>/dev/null
  exec 3>&- 2>/dev/null
  return $result
}

# Already running: just open a browser tab, no terminal, no second `npm run dev`
# (which would fail anyway since vite's `strictPort` refuses to reuse the port).
if is_frontend_running; then
  nohup xdg-open "$URL" >/dev/null 2>&1 &
  disown
  exit 0
fi

# Opens start.sh inside a real terminal window, trying each of these emulators in order
# until one launches (same fallback list/order used by the "Continuar" button's
# server/services/sessionService.ts, which is known to work reliably in this environment).
# We spawn the terminal ourselves instead of relying on the .desktop file's own
# `Terminal=true` handling, since that has been observed to sometimes silently do nothing
# when launched from the GNOME dock.
TERMINAL_LAUNCHERS=(x-terminal-emulator gnome-terminal konsole xfce4-terminal xterm)

# `read` at the end keeps the window open after `npm run dev` exits (success, crash, or
# Ctrl+C), so the terminal is never left blank or closes before you can read the output.
SHELL_CMD="'$PROJECT_DIR/start.sh'; echo; read -p 'Press Enter to close...' _"

for bin in "${TERMINAL_LAUNCHERS[@]}"; do
  if command -v "$bin" >/dev/null 2>&1; then
    # Each emulator's flag for "run this command" differs (gnome-terminal wants `--`,
    # xfce4-terminal wants `-x`); bash/-c/command are passed as separate argv entries,
    # matching sessionService.ts's TERMINAL_LAUNCHERS exactly.
    case "$bin" in
      gnome-terminal) exec "$bin" -- bash -c "$SHELL_CMD" ;;
      xfce4-terminal) exec "$bin" -x bash -c "$SHELL_CMD" ;;
      *) exec "$bin" -e bash -c "$SHELL_CMD" ;;
    esac
  fi
done

echo "No terminal emulator found (tried: ${TERMINAL_LAUNCHERS[*]})." >&2
exit 1
