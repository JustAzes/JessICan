#!/bin/bash
# Erzeugt sass/_bootstrap-subset.scss neu.
#
# Die Datei enthält nur die Bootstrap-Regeln, die im fertigen Build tatsächlich
# vorkommen. Sie muss neu erzeugt werden, wenn Templates neue Bootstrap-Klassen
# verwenden. Ablauf:
#
#   zola build -o public_check      # Build mit dem aktuellen Stand
#   ./tools/build-css.sh public_check
#   rm -rf public_check
#
# Danach einmal `zola build` laufen lassen und die Seiten prüfen.
set -euo pipefail

BUILD_DIR="${1:-public_check}"
SCRIPT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$BUILD_DIR" ]; then
  echo "Build-Verzeichnis '$BUILD_DIR' fehlt. Erst 'zola build -o $BUILD_DIR' ausführen." >&2
  exit 1
fi

python3 "$SCRIPT_ROOT/tools/bootstrap-subset.py" "$BUILD_DIR" "$SCRIPT_ROOT/sass/_bootstrap-subset.scss"

echo "sass/_bootstrap-subset.scss aktualisiert."
