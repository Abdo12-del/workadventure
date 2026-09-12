#!/usr/bin/env bash
#
# Regenerates every NG Academy brand asset (favicons, app icons, logos, loader)
# from the vector sources in brand/:
#
#   brand/app-mark.svg             -> all square icons / favicons / ico   (via sharp)
#   brand/logo-lockup-white.svg    -> horizontal white logo               (via sharp)
#   brand/gino-logo-source.png     -> Gino character art, ng/gino.png     (via ImageMagick)
#
# The generated files OVERWRITE the former WorkAdventure assets under the exact same
# file names, so no application code has to change to pick up the new identity.
# Outputs are quantized on purpose: children may run the app on weak devices.
#
# Requirements: node (+ npm, to fetch `sharp` once into .bootstrap-tools/) and ImageMagick.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRAND="$ROOT/brand"
TOOLS="$ROOT/.bootstrap-tools"
FAV="$ROOT/play/public/static/images/favicons"
IMAGES="$ROOT/play/public/static/images"
COMP="$ROOT/play/src/front/Components/images"
NG="$IMAGES/ng"
GINO_SRC="$BRAND/gino-logo-source.png"

mkdir -p "$NG"

echo "==> 1/6 ensuring the sharp rasterizer"
if [ ! -d "$TOOLS/node_modules/sharp" ]; then
    mkdir -p "$TOOLS"
    [ -f "$TOOLS/package.json" ] || printf '{"name":"wa-bootstrap-tools","private":true,"version":"1.0.0"}\n' >"$TOOLS/package.json"
    (cd "$TOOLS" && npm install --no-audit --no-fund --ignore-scripts sharp >/dev/null)
fi

echo "==> 2/6 rasterizing vector brand sources"
node "$BRAND/rasterize.mjs" "$TOOLS/node_modules"

echo "==> 3/6 svg sources & multi-resolution ico"
cp "$BRAND/app-mark.svg" "$FAV/favicon-512x512.svg"
cp "$BRAND/logo-lockup-white.svg" "$COMP/logo.svg"
cp "$BRAND/logo-lockup-white.svg" "$NG/logo-white.svg"
convert "$FAV/favicon-16x16.png" "$FAV/favicon-32x32.png" "$FAV/favicon-96x96.png" \
    "$FAV/icon-512x512.png" -define icon:auto-resize=16,24,32,48,64 "$FAV/favicon.ico"

echo "==> 4/6 loader animation (replaces Workadventure.gif)"
for i in 0 1 2 3 4 5 6 7; do
    dy=$(( 14 + (i * i * 5) % 40 ))
    convert -size 220x250 xc:none "$BRAND/tmp-owl.png" -gravity north -geometry +0+"$dy" -composite "$BRAND/tmp-frame$i.png"
done
convert -delay 7 -loop 0 "$BRAND"/tmp-frame*.png -layers Optimize -strip "$COMP/Workadventure.gif"
rm -f "$BRAND"/tmp-frame*.png "$BRAND/tmp-owl.png"

echo "==> 5/6 Gino character art"
W=$(identify -format '%w' "$GINO_SRC")
H=$(identify -format '%h' "$GINO_SRC")
X=$((W - 1))
Y=$((H - 1))
convert "$GINO_SRC" -alpha set -fuzz 14% -fill none \
    -draw "color 0,0 floodfill" \
    -draw "color $X,0 floodfill" \
    -draw "color 0,$Y floodfill" \
    -draw "color $X,$Y floodfill" \
    -trim +repage -resize 640x -strip -depth 8 -colors 128 -define png:compression-level=9 "$NG/gino.png"
convert "$NG/gino.png" -fill white -colorize 100 -colors 2 "$NG/gino-white.png"

echo "==> 6/6 browserconfig tile colour & summary"
sed -i 's|<TileColor>#[0-9a-fA-F]\{6\}</TileColor>|<TileColor>#38b6ff</TileColor>|' "$FAV/browserconfig.xml"
du -sh "$FAV" "$NG"
identify "$IMAGES/logo.png" "$COMP/Workadventure.gif" | head -3
echo "done."
