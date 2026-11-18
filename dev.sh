#!/usr/bin/env bash
# Convenience wrapper for `tauri dev`.
# Usage: ./dev.sh [-- <path to folder or media file>]
set -euo pipefail
cd "$(dirname "$0")"

# Avoid GTK warnings in minimal/desktop-less environments.
export GSETTINGS_BACKEND="${GSETTINGS_BACKEND:-memory}"

if [[ "$(uname -s)" == "Linux" ]] && ! pkg-config --exists alsa; then
  echo "warning: ALSA development headers not found." >&2
  echo "  Debian/Ubuntu: sudo apt install libasound2-dev" >&2
  echo "  Fedora:        sudo dnf install alsa-lib-devel" >&2
  echo "  Arch:          sudo pacman -S alsa-lib" >&2
fi

if command -v cargo-tauri >/dev/null 2>&1; then
  exec cargo tauri dev "$@"
fi

exec npx tauri dev "$@"
