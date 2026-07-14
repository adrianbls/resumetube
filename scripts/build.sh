#!/usr/bin/env bash

set -eu

ROOT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(node -p "JSON.parse(require('fs').readFileSync('$ROOT_DIR/manifest.json', 'utf8')).version")"
PACKAGE="$DIST_DIR/resumetube-$VERSION.zip"

cd "$ROOT_DIR"

node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"
node --check content/content-script.js
node --input-type=module --check < popup/prompt.js
node --input-type=module --check < popup/popup.js
node --test tests/*.test.js

mkdir -p "$DIST_DIR"
zip -q -r -FS "$PACKAGE" \
  manifest.json \
  _locales \
  content \
  popup \
  icons

echo "Paquete creado: $PACKAGE"
