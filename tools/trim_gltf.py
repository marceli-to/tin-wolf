#!/usr/bin/env python3
"""Trim a self-contained .gltf (base64 buffers) to the listed animations and write a compact .glb.

Usage: python3 tools/trim_gltf.py in.gltf out.glb [AnimName ...]
With no animation names, all animations are kept (the file is only repacked as binary).
Only bufferViews still referenced after trimming are written, so dropped animation data is gone.
"""
import base64, json, struct, sys

def main():
    src, dst, keep = sys.argv[1], sys.argv[2], set(sys.argv[3:])
    g = json.load(open(src))
    blobs = []
    for b in g['buffers']:
        uri = b['uri']
        assert uri.startswith('data:'), 'expects embedded buffers'
        blobs.append(base64.b64decode(uri.split(',', 1)[1]))
    if keep:
        g['animations'] = [a for a in g.get('animations', []) if a['name'] in keep]
        missing = keep - {a['name'] for a in g['animations']}
        if missing: sys.exit(f'missing animations: {sorted(missing)}')

    # Find every accessor still in use.
    used_acc = set()
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ('accessor', 'indices', 'input', 'output', 'inverseBindMatrices') and isinstance(v, int): used_acc.add(v)
                elif k == 'attributes' and isinstance(v, dict): used_acc.update(v.values())
                elif k == 'targets' and isinstance(v, list):
                    for t in v: used_acc.update(t.values())
                else: walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    for key in ('meshes', 'skins', 'animations'): walk(g.get(key, []))
    # Images can reference bufferViews too.
    used_views = {g['accessors'][a]['bufferView'] for a in used_acc if 'bufferView' in g['accessors'][a]}
    used_views |= {im['bufferView'] for im in g.get('images', []) if 'bufferView' in im}

    acc_map, view_map, out = {}, {}, bytearray()
    new_views = []
    for vi, v in enumerate(g['bufferViews']):
        if vi not in used_views: continue
        data = blobs[v.get('buffer', 0)][v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
        while len(out) % 4: out.append(0)
        nv = dict(v); nv['buffer'] = 0; nv['byteOffset'] = len(out)
        out += data
        view_map[vi] = len(new_views); new_views.append(nv)
    new_acc = []
    for ai, a in enumerate(g['accessors']):
        if ai not in used_acc: continue
        na = dict(a)
        if 'bufferView' in na: na['bufferView'] = view_map[na['bufferView']]
        acc_map[ai] = len(new_acc); new_acc.append(na)

    def remap(o):
        if isinstance(o, dict):
            for k, v in list(o.items()):
                if k in ('accessor', 'indices', 'input', 'output', 'inverseBindMatrices') and isinstance(v, int): o[k] = acc_map[v]
                elif k == 'attributes' and isinstance(v, dict): o[k] = {kk: acc_map[vv] for kk, vv in v.items()}
                elif k == 'targets' and isinstance(v, list): o[k] = [{kk: acc_map[vv] for kk, vv in t.items()} for t in v]
                else: remap(v)
        elif isinstance(o, list):
            for v in o: remap(v)
    for key in ('meshes', 'skins', 'animations'): remap(g.get(key, []))
    for im in g.get('images', []):
        if 'bufferView' in im: im['bufferView'] = view_map[im['bufferView']]
    g['accessors'], g['bufferViews'] = new_acc, new_views
    while len(out) % 4: out.append(0)
    g['buffers'] = [{'byteLength': len(out)}]

    js = json.dumps(g, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
    print(f'{dst}: {total/1024:.0f} KB, {len(g.get("animations", []))} animations')

main()
