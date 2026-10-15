"""Rebuild src/assets/*.svg from the SVG data extracted from the Figma file (SignScribe - Screens and Flow)."""
import json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = f'{root}/src/assets'; os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.endswith('.svg'): os.remove(f'{out}/{f}')
svgs = {}
for p in range(3):
    svgs.update(json.load(open(f'{root}/tools/svgs_part{p}.json')))
hd = json.load(open(f'{root}/tools/hands_data.json'))
NS = ' xmlns="http://www.w3.org/2000/svg"'
def fn(nid): return 'n' + nid.replace(':', '-') + '.svg'
count = 0
for tok in hd['nodeMap'].split():
    nid, key = tok.rsplit(':', 1)
    s = svgs[key].replace('<svg ', '<svg' + NS + ' ', 1)
    open(f'{out}/{fn(nid)}', 'w').write(s); count += 1
def fmt(v): return ('%.3f' % v).rstrip('0').rstrip('.')
for t in hd['tuples']:
    parts = t.split(' ')
    nid, c, W, H, stroke, dotc, sw, r = parts[0], int(parts[1]), float(parts[2]), float(parts[3]), parts[4], parts[5], int(parts[6]), int(parts[7])
    op = parts[8] if len(parts) > 8 else ''
    cl = hd['clusters'][c]
    body = []
    for line in cl['lines'].split(';'):
        n = list(map(int, line.split()))
        pts = [(n[i] / 1000 * W, n[i + 1] / 1000 * H) for i in range(0, len(n), 2)]
        d = 'M' + 'L'.join(f'{fmt(x)} {fmt(y)}' for x, y in pts)
        body.append(f'<path d="{d}" stroke="{stroke}" stroke-width="{fmt(sw / 10000 * W)}" stroke-linecap="round" stroke-linejoin="round"/>')
    for dot in cl['dots'].split(';'):
        x, y = map(int, dot.split())
        body.append(f'<circle cx="{fmt(x / 1000 * W)}" cy="{fmt(y / 1000 * H)}" r="{fmt(r / 10000 * W)}" fill="{dotc}"/>')
    inner = ''.join(body)
    if op: inner = f'<g opacity="{op}">{inner}</g>'
    s = f'<svg{NS} width="{fmt(W)}" height="{fmt(H)}" viewBox="0 0 {fmt(W)} {fmt(H)}" fill="none">{inner}</svg>'
    open(f'{out}/{fn(nid)}', 'w').write(s); count += 1
# --- recolored variants for selected / unselected states (geometry untouched) ---
EXTRA_HANDS = [  # id, cluster, W, H, stroke, dot, sw, r
    ('x:left-teal', 4, 100, 130, '#0F766E', '#0F766E', 250, 313),
    ('x:right-gray', 0, 100, 130, '#64748B', '#64748B', 250, 313),
]
for nid, c, W, H, stroke, dotc, sw, r in EXTRA_HANDS:
    cl = hd['clusters'][c]; body = []
    for line in cl['lines'].split(';'):
        n = list(map(int, line.split()))
        pts = [(n[i] / 1000 * W, n[i + 1] / 1000 * H) for i in range(0, len(n), 2)]
        body.append('<path d="M' + 'L'.join(f'{fmt(x)} {fmt(y)}' for x, y in pts) + f'" stroke="{stroke}" stroke-width="{fmt(sw / 10000 * W)}" stroke-linecap="round" stroke-linejoin="round"/>')
    for dot in cl['dots'].split(';'):
        x, y = map(int, dot.split())
        body.append(f'<circle cx="{fmt(x / 1000 * W)}" cy="{fmt(y / 1000 * H)}" r="{fmt(r / 10000 * W)}" fill="{dotc}"/>')
    open(f'{out}/{fn(nid)}', 'w').write(f'<svg{NS} width="{W}" height="{H}" viewBox="0 0 {W} {H}" fill="none">' + ''.join(body) + '</svg>'); count += 1
RECOLOR = [  # new id, source node, from, to
    ('x:cross-teal', '2:543', 'white', '#0F766E'),
    ('x:bag-white', '2:549', '#0F766E', 'white'),
    ('x:brief-white', '2:556', '#0F766E', 'white'),
    ('x:home-white', '2:563', '#0F766E', 'white'),
]
for nid, src, a, b in RECOLOR:
    s = open(f'{out}/{fn(src)}').read().replace(f'stroke="{a}"', f'stroke="{b}"')
    open(f'{out}/{fn(nid)}', 'w').write(s); count += 1
print('wrote', count, 'svg files')
