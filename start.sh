#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# yarn/node come from nvm, which this user's ~/.zshrc loads onto PATH for interactive
# shells only. This script can be run from a plain non-interactive `bash -c` (e.g. spawned
# directly by a terminal emulator from the desktop shortcut), where that never happens —
# so load nvm ourselves whenever yarn isn't already reachable.
if ! command -v yarn >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

yarn dev
