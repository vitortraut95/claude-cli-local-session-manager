#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# yarn/node come from nvm, which only auto-loads in interactive shells; this may run from a
# non-interactive `bash -c`, so load nvm when yarn isn't on PATH.
if ! command -v yarn >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

yarn dev
