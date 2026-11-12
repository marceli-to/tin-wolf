#!/usr/bin/env python3
"""Pack a .gltf with external .bin and image files into one .glb, downsizing images.

Usage: python3 tools/gltf_pack.py in.gltf out.glb [--tex-dir DIR] [--max-size 512] [--shared-tex DIR]
Images are looked up next to the .gltf, then in --tex-dir. Resizing uses macOS `sips`.
With --shared-tex, images are written once into that folder (resized) and referenced by a relative
URI instead of being embedded, so models that share a texture atlas share one file.
"""
import argparse, json, os, struct, subprocess, tempfile

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--tex-dir', default=None); ap.add_argument('--max-size', type=int, default=512)
ap.add_argument('--shared-tex', default=None)
a = ap.parse_args()
base = os.path.dirname(os.path.abspath(a.src))
g = json.load(open(a.src))

def find(uri):
    for d in (base, a.tex_dir):
        if d and os.path.exists(os.path.join(d, uri)): return os.path.join(d, uri)
    raise SystemExit(f'missing file: {uri}')

blobs = [open(find(b['uri']), 'rb').read() for b in g['buffers']]
out = bytearray()
views = []
for v in g['bufferViews']:
    data = blobs[v.get('buffer', 0)][v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    while len(out) % 4: out.append(0)
    nv = dict(v); nv['buffer'] = 0; nv['byteOffset'] = len(out); out += data; views.append(nv)
cache = {}
for im in g.get('images', []):
    uri = im.pop('uri', None)
    if uri is None: continue
    if a.shared_tex:
        os.makedirs(a.shared_tex, exist_ok=True)
        target = os.path.join(a.shared_tex, os.path.basename(uri))
        if not os.path.exists(target):
            subprocess.run(['sips', '-Z', str(a.max_size), find(uri), '--out', target], capture_output=True, check=True)
        im['uri'] = os.path.relpath(target, os.path.dirname(os.path.abspath(a.dst)))
        continue
    if uri not in cache:
        src = find(uri)
        with tempfile.TemporaryDirectory() as td:
            tmp = os.path.join(td, 'img.png')
            subprocess.run(['sips', '-Z', str(a.max_size), src, '--out', tmp], capture_output=True, check=True)
            cache[uri] = open(tmp, 'rb').read()
    data = cache[uri]
    while len(out) % 4: out.append(0)
    views.append({'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)})
    out += data
    im['bufferView'] = len(views) - 1
    im['mimeType'] = 'image/png'
g['bufferViews'] = views
while len(out) % 4: out.append(0)
g['buffers'] = [{'byteLength': len(out)}]
js = json.dumps(g, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
with open(a.dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
print(f'{a.dst}: {os.path.getsize(a.dst)/1024:.0f} KB')
