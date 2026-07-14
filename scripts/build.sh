#!/usr/bin/env bash

set -eu

ROOT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(node -p "JSON.parse(require('fs').readFileSync('$ROOT_DIR/manifest.json', 'utf8')).version")"
FIREFOX_PACKAGE="$DIST_DIR/resumetube-$VERSION.zip"
CHROME_PACKAGE="$DIST_DIR/resumetube-chrome-$VERSION.zip"

cd "$ROOT_DIR"

# Validaciones comunes.
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"
node --check content/content-script.js
node --input-type=module --check < popup/prompt.js
node --input-type=module --check < popup/popup.js
node --input-type=module --check < popup/i18n.js
node --test tests/*.test.js

SOURCES=(manifest.json _locales content popup icons)

mkdir -p "$DIST_DIR"

# Firefox: se empaqueta el árbol tal cual (incluye browser_specific_settings.gecko).
rm -f "$FIREFOX_PACKAGE"
zip -q -r -FS "$FIREFOX_PACKAGE" "${SOURCES[@]}"
echo "Paquete Firefox: $FIREFOX_PACKAGE"

# Chrome: mismo contenido pero con un manifiesto sin las claves específicas de Gecko.
STAGE="$(mktemp -d)"
cp -r "${SOURCES[@]}" "$STAGE/"
node -e "
  const fs = require('fs');
  const path = '$STAGE/manifest.json';
  const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
  delete manifest.browser_specific_settings;
  fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
"
rm -f "$CHROME_PACKAGE"
( cd "$STAGE" && zip -q -r -FS "$CHROME_PACKAGE" "${SOURCES[@]}" )
rm -rf "$STAGE"
echo "Paquete Chrome: $CHROME_PACKAGE"
