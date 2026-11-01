#!/usr/bin/env sh
# Runs build.py with Blender's Python module (bpy). First run: creates tools/blender/.venv and installs it.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
PY="${BLENDER_PYTHON:-$DIR/.venv/bin/python}"
if [ ! -x "$PY" ]; then
  python3 -m venv "$DIR/.venv"
  "$DIR/.venv/bin/pip" install -q -r "$DIR/requirements.txt"
  PY="$DIR/.venv/bin/python"
fi
exec "$PY" "$DIR/build.py" "$@"
