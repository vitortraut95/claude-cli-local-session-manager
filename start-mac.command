#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FRONTEND_PORT=58230
URL="http://localhost:$FRONTEND_PORT"

# Same zero-dependency port probe as open-terminal.sh (bash's own /dev/tcp pseudo-device,
# not curl) — works identically on macOS's bash, no extra tool required.
is_frontend_running() {
  (exec 3<>"/dev/tcp/127.0.0.1/$FRONTEND_PORT") 2>/dev/null
  local result=$?
  exec 3<&- 2>/dev/null
  exec 3>&- 2>/dev/null
  return $result
}

# Already running: just open a browser tab, no second `yarn dev` (which would fail anyway
# since Vite's strictPort refuses to reuse the port). `open` is macOS's xdg-open equivalent.
if is_frontend_running; then
  open "$URL"
  exit 0
fi

# Double-clicking a .command file already opens this in Terminal.app on its own — unlike the
# Linux/Windows launchers, no code here needs to pick/spawn a terminal emulator.
cd "$PROJECT_DIR"
yarn dev

# Keeps the window open after `yarn dev` exits (success, crash, or Ctrl+C) — Terminal.app's
# default "close the window" setting would otherwise close it before you can read the output.
echo
read -p "Press Enter to close..." _
