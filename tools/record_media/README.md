# Recording the landing page media

Scripted gameplay clips, screenshots and the share image for the landing page, recorded from the built game in headless Chrome. Nothing here is part of the game or the build.

Needs (set `CHANNEL=chrome` to use the installed Google Chrome instead of Playwright's own browser): `playwright-core` somewhere on disk (not a project dependency; point `PLAYWRIGHT_CORE` at it, e.g. `PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core`), Google Chrome or Playwright's Chromium, `ffmpeg` and `cwebp`.

```sh
npm run build && npx vite preview --port 4173 &        # the game at http://localhost:4173/play/
OUT=/some/scratch/folder
node tools/record_media/record.cjs $OUT                  # clips (frames + ffconcat lists) and screenshots
node tools/record_media/captions.cjs $OUT                # caption cards for each clip
python3 tools/record_media/assemble.py $OUT              # $OUT/tinfox-gameplay.mp4 (1080p, captioned)
tools/record_media/web.sh $OUT                           # encodes everything into public/media
node tools/record_media/og.cjs $OUT/shots/02_toyfactory_split.png   # public/og-image.png
```

`node record.cjs $OUT toyfactory depot` records only those scenes (menu, toyfactory, space, depot, training, castle).

How it works: `director.js` is injected into the page and drives players in real time through the `?debug=1` hooks (`window.__game`): teleport, smooth look, walk to a point, shoot. The debug overlays are hidden. Each clip is a CDP screencast of JPEG frames with timestamps; `assemble.py` turns them into constant 30 fps video with ffmpeg. GPU rendering (`--use-angle=metal`) keeps it at 60 fps; software rendering works but stutters.

The scenes are scripted against the current levels (positions, the guard `y1` in the depot, the grenade pit throw at 50° from (37, 70.2)); change a level and the matching scene may need new coordinates. The still times in `web.sh` fit the scripted timing.

Playwright's bundled Chromium cannot decode H.264, so check video playback on the landing page with real Chrome (`channel: 'chrome'`).
