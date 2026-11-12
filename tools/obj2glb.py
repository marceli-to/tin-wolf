#!/usr/bin/env python3
"""Convert an OBJ (+ its MTL diffuse colours) to a .glb with one primitive per material.

Usage: python3 tools/obj2glb.py in.obj out.glb
Polygons are fan-triangulated; missing normals are computed per face.
"""
import json, math, os, struct, sys

src, dst = sys.argv[1], sys.argv[2]
mats, cur = {}, None
pos, nrm = [], []
faces = {}  # material -> list of (v, n) index triples per triangle
mtl_file = None
for line in open(src, encoding='utf-8', errors='replace'):
    p = line.split()
    if not p: continue
    if p[0] == 'mtllib': mtl_file = os.path.join(os.path.dirname(src), ' '.join(p[1:]))
    elif p[0] == 'v': pos.append([float(x) for x in p[1:4]])
    elif p[0] == 'vn': nrm.append([float(x) for x in p[1:4]])
    elif p[0] == 'usemtl': cur = ' '.join(p[1:])
    elif p[0] == 'f':
        idx = []
        for t in p[1:]:
            s = t.split('/')
            vi = int(s[0]); vi = vi - 1 if vi > 0 else len(pos) + vi
            ni = None
            if len(s) > 2 and s[2]:
                ni = int(s[2]); ni = ni - 1 if ni > 0 else len(nrm) + ni
            idx.append((vi, ni))
        for k in range(1, len(idx) - 1):
            faces.setdefault(cur, []).append((idx[0], idx[k], idx[k + 1]))
if mtl_file and os.path.exists(mtl_file):
    m = None
    for line in open(mtl_file, encoding='utf-8', errors='replace'):
        p = line.split()
        if not p: continue
        if p[0] == 'newmtl': m = ' '.join(p[1:]); mats[m] = [0.8, 0.8, 0.8]
        elif p[0] == 'Kd' and m: mats[m] = [float(x) for x in p[1:4]]

def sub(a, b): return [a[i] - b[i] for i in range(3)]
def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def norm(a):
    l = math.sqrt(sum(x*x for x in a)) or 1
    return [x / l for x in a]

out = bytearray(); views = []; accessors = []; prims = []; materials = []
def add_view(data, target):
    while len(out) % 4: out.append(0)
    views.append({'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data), 'target': target})
    out.extend(data)
    return len(views) - 1
for mi, (mname, tris) in enumerate(faces.items()):
    P, N = [], []
    for tri in tris:
        fn = None
        for (vi, ni) in tri:
            P.append(pos[vi])
            if ni is not None and ni < len(nrm): N.append(nrm[ni])
            else:
                if fn is None: fn = norm(cross(sub(pos[tri[1][0]], pos[tri[0][0]]), sub(pos[tri[2][0]], pos[tri[0][0]])))
                N.append(fn)
    pv = add_view(b''.join(struct.pack('<3f', *v) for v in P), 34962)
    nv = add_view(b''.join(struct.pack('<3f', *v) for v in N), 34962)
    lo = [min(v[i] for v in P) for i in range(3)]; hi = [max(v[i] for v in P) for i in range(3)]
    accessors.append({'bufferView': pv, 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': lo, 'max': hi})
    accessors.append({'bufferView': nv, 'componentType': 5126, 'count': len(N), 'type': 'VEC3'})
    c = mats.get(mname, [0.8, 0.8, 0.8])
    materials.append({'name': mname or 'default', 'pbrMetallicRoughness': {'baseColorFactor': [*c, 1], 'metallicFactor': 0, 'roughnessFactor': 0.9}})
    prims.append({'attributes': {'POSITION': len(accessors) - 2, 'NORMAL': len(accessors) - 1}, 'material': mi})
name = os.path.splitext(os.path.basename(src))[0]
g = {'asset': {'version': '2.0', 'generator': 'tin-wolf obj2glb'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
     'nodes': [{'name': name, 'mesh': 0}], 'meshes': [{'name': name, 'primitives': prims}],
     'materials': materials, 'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(out)}]}
js = json.dumps(g, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(out) % 4: out.append(0)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
print(f'{dst}: {os.path.getsize(dst)/1024:.0f} KB, {len(prims)} materials')
