#!/usr/bin/env bash
set -e
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$APP_DIR/claude-session-manager.desktop.template"
DESKTOP_FILE="$APP_DIR/claude-session-manager.desktop"

sed "s|__APP_DIR__|$APP_DIR|g" "$TEMPLATE" > "$DESKTOP_FILE"
chmod +x "$DESKTOP_FILE" "$APP_DIR/start.sh" "$APP_DIR/open-terminal.sh"

APPLICATIONS_DIR="$HOME/.local/share/applications"
mkdir -p "$APPLICATIONS_DIR"
cp "$DESKTOP_FILE" "$APPLICATIONS_DIR/claude-session-manager.desktop"
chmod +x "$APPLICATIONS_DIR/claude-session-manager.desktop"

DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
if [ -n "$DESKTOP_DIR" ] && [ -d "$DESKTOP_DIR" ]; then
  cp "$DESKTOP_FILE" "$DESKTOP_DIR/claude-session-manager.desktop"
  chmod +x "$DESKTOP_DIR/claude-session-manager.desktop"
  gio set "$DESKTOP_DIR/claude-session-manager.desktop" metadata::trusted true 2>/dev/null || true
fi

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPLICATIONS_DIR" 2>/dev/null || true

echo "Atalho instalado! Procure por \"Claude Session Manager\" no menu de aplicativos do GNOME ou confira a Área de Trabalho."
