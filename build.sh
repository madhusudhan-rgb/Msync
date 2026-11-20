#!/usr/bin/env bash
set -euo pipefail

CLEAN=0
RUN=1
CONFIG="Release"
BUILD_DIR="build"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean) CLEAN=1; shift ;;
    --no-run) RUN=0; shift ;;
    --config) CONFIG="$2"; shift 2 ;;
    --build-dir) BUILD_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--clean] [--no-run] [--config Debug|Release] [--build-dir DIR]"
      exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

cd "$(dirname "$0")"

if ! command -v cmake >/dev/null 2>&1; then
  echo "cmake not found" >&2
  exit 1
fi

# always clean so changes are never stale
if [[ -d "$BUILD_DIR" ]]; then
  echo "Cleaning $BUILD_DIR..."
  rm -rf "$BUILD_DIR"
fi

if [[ ! -f "$BUILD_DIR/CMakeCache.txt" ]]; then
  echo "Configuring ($CONFIG)..."
  cmake -S . -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE="$CONFIG"
fi

echo "Building..."
cmake --build "$BUILD_DIR" --config "$CONFIG" --parallel "$(nproc)"

EXE="$BUILD_DIR/MP3IMGUI"
if [[ ! -x "$EXE" ]]; then
  EXE="$BUILD_DIR/$CONFIG/MP3IMGUI"
fi
if [[ ! -x "$EXE" ]]; then
  echo "Executable not found" >&2
  exit 1
fi

echo "Built: $EXE"

if [[ "$RUN" == "1" ]]; then
  echo "Launching..."
  export GDK_BACKEND=x11
  exec "$EXE"
fi
