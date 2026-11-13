#!/bin/zsh
# Deploys the committed state of this repository to tinfox.kimiyu.ch (Hostpoint) over SSH,
# using your own SSH key. Run from your Mac: ./deploy.sh
#
# Tin Fox is a static site: the game is built locally (npm run build) and dist/ is mirrored
# into the web root. Files on the server that are not in the build (old bundles, removed
# models) are deleted.
set -euo pipefail
cd "$(dirname "$0")"

HOST=pumutuxu@pumutuxu.myhostpoint.ch
DEST=/home/pumutuxu/www/tinfox.kimiyu.ch/public   # the web root

if [[ -n $(git status --porcelain) ]]; then
  echo "You have uncommitted changes. Commit them first; only committed code is deployed."
  exit 1
fi

echo "Running tests…"
npm test --silent

echo "Building $(git rev-parse --short HEAD)…"
rm -rf dist
npm run build --silent
# Hashed file names change with every build; make sure both pages (landing and game) made it.
if [[ ! -f dist/index.html || ! -f dist/play/index.html || ! -f dist/.htaccess ]]; then
  echo "dist/ is incomplete. Check the build output."
  exit 1
fi

echo "Uploading…"
rsync -az --delete --exclude '.DS_Store' dist/ "$HOST:$DEST/"

echo "Deployed $(git rev-parse --short HEAD) to https://tinfox.kimiyu.ch"
