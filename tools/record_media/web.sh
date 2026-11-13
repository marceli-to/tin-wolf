#!/bin/zsh
# Encodes the landing page media in public/media from a recording (see README.md).
# Usage: tools/record_media/web.sh <outDir>   (the folder record.cjs and assemble.py wrote)
set -euo pipefail
OUT=${1:?usage: web.sh <outDir>}
M="$(cd "$(dirname "$0")/../.." && pwd)/public/media"
mkdir -p "$M"

# Trailer: the captioned video at 1080p and 720p, no sound, fast start for streaming.
ffmpeg -v error -y -i "$OUT/tinfox-gameplay.mp4" -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart -an "$M/trailer-1080.mp4"
ffmpeg -v error -y -i "$OUT/tinfox-gameplay.mp4" -vf scale=1280:720 -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart -an "$M/trailer-720.mp4"

# Hero loop: 7 s of split-screen from the Toy Factory clip (no caption), 720p.
ffmpeg -v error -y -f concat -safe 0 -i "$OUT/frames/02_toyfactory/list.ffconcat" \
  -vf "select='between(t,3.9,10.9)',setpts=PTS-STARTPTS,fps=30,scale=1280:720,fade=t=in:st=0:d=0.25,fade=t=out:st=6.7:d=0.3,format=yuv420p" \
  -c:v libx264 -preset slow -crf 29 -movflags +faststart -an "$M/hero-loop.mp4"
ffmpeg -v error -y -i "$M/hero-loop.mp4" -vf "select=eq(n\,12)" -frames:v 1 -update 1 "$OUT/hero-poster.png"
cwebp -quiet -q 80 "$OUT/hero-poster.png" -o "$M/hero-poster.webp"

# Action stills taken from the clips (times fit the scripted scenes in record.cjs).
grab() { ffmpeg -v error -y -f concat -safe 0 -i "$OUT/frames/$1/list.ffconcat" -vf "select='gte(t,$2)'" -frames:v 1 -update 1 "$OUT/shots/$3.png"; }
grab 02_toyfactory 9.0 07_toyfactory_scope_kill
grab 03_depot 8.6 08_depot_scope_barrel
grab 04_training_course 4.5 09_training_dummy
grab 05_training_deck 2.4 10_deck_scope_rail

# Screenshots: WebP at 1600 and 800 px wide, only the ones the landing page uses.
for f in 02_toyfactory_split 04_training_deck 06_castle 07_toyfactory_scope_kill 08_depot_scope_barrel 09_training_dummy 10_deck_scope_rail 11_space_bots; do
  n=${f#*_}
  cwebp -quiet -q 80 -resize 1600 0 "$OUT/shots/$f.png" -o "$M/shot-$n-1600.webp"
  cwebp -quiet -q 78 -resize 800 0 "$OUT/shots/$f.png" -o "$M/shot-$n-800.webp"
done
ls -la "$M"
