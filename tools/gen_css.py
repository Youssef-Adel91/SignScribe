"""Generates src/styles/atomic.css from the utility class names used in src/**/*.tsx.

The class names are the ones Figma's code export produced (Tailwind-style arbitrary values such as
`h-[68px]`, `bg-[#f8fafc]`), so every pixel value in the app maps 1:1 to the Figma file. This script turns
each used class into plain CSS, so no Tailwind dependency is needed.  Run:  npm run css
"""
import re, os, sys, glob
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def esc(c): return re.sub(r'([^a-zA-Z0-9_-])', r'\\\1', c)
def px(v): return v if v.endswith('px') else v + 'px'
def isColor(v): return v.startswith('#') or v.startswith('rgb')
def us(v): return v.replace('_', ' ')

FIXED = {
 'flex': 'display:flex', 'contents': 'display:contents', 'block': 'display:block', 'flex-col': 'flex-direction:column',
 'relative': 'position:relative', 'absolute': 'position:absolute',
 'shrink-0': 'flex-shrink:0', 'content-stretch': 'align-content:stretch',
 'items-start': 'align-items:flex-start', 'items-center': 'align-items:center',
 'justify-start': 'justify-content:flex-start', 'justify-center': 'justify-content:center', 'justify-between': 'justify-content:space-between',
 'size-full': 'width:100%;height:100%', 'size-px': 'width:1px;height:1px',
 'w-full': 'width:100%', 'h-full': 'height:100%', 'w-px': 'width:1px', 'h-px': 'height:1px',
 'min-w-px': 'min-width:1px', 'min-h-px': 'min-height:1px', 'min-w-full': 'min-width:100%',
 'max-w-none': 'max-width:none', 'inset-0': 'top:0;right:0;bottom:0;left:0',
 'overflow-clip': 'overflow:clip', 'whitespace-nowrap': 'white-space:nowrap',
 'text-center': 'text-align:center', 'not-italic': 'font-style:normal',
 'font-bold': 'font-weight:700', 'font-semibold': 'font-weight:600', 'font-medium': 'font-weight:500', 'font-normal': 'font-weight:400',
 'border': 'border-width:1px', 'border-2': 'border-width:2px', 'border-3': 'border-width:3px', 'border-4': 'border-width:4px',
 'border-b': 'border-bottom-width:1px', 'border-t': 'border-top-width:1px',
 'border-solid': 'border-style:solid', 'border-dashed': 'border-style:dashed',
 'border-white': 'border-color:#fff', 'bg-white': 'background-color:#fff', 'text-white': 'color:#fff',
 'mb-0': 'margin-bottom:0', 'w-[min-content]': 'width:min-content',
 'flex-[1_0_0]': 'flex:1 0 0', '[word-break:break-word]': 'word-break:break-word',
 "font-['Inter:Bold']": "font-family:'Inter',sans-serif", "font-['Inter:Semi_Bold']": "font-family:'Inter',sans-serif",
 "font-['Inter:Medium']": "font-family:'Inter',sans-serif", "font-['Inter:Regular']": "font-family:'Inter',sans-serif",
}
def decl(c):
    if c in FIXED: return FIXED[c]
    m = re.fullmatch(r'(h|w|size|gap|px|py|pl|pr|pt|pb|mt|mb|ml|mr|left|top|right|bottom|leading|rounded|tracking|min-h|min-w|max-w|max-h)-\[(.+)\]', c)
    if m:
        k, v = m.groups()
        if v == '0' : v = '0'
        else: v = us(v)
        if k not in ('leading',) and re.fullmatch(r'-?[\d.]+', v) and v != '0': v = v + 'px'
        P = {'h': ['height'], 'w': ['width'], 'size': ['width', 'height'], 'gap': ['gap'],
             'px': ['padding-left', 'padding-right'], 'py': ['padding-top', 'padding-bottom'],
             'mt': ['margin-top'], 'mb': ['margin-bottom'], 'ml': ['margin-left'], 'mr': ['margin-right'], 'pl': ['padding-left'], 'pr': ['padding-right'], 'pt': ['padding-top'], 'pb': ['padding-bottom'],
             'left': ['left'], 'top': ['top'], 'right': ['right'], 'bottom': ['bottom'],
             'leading': ['line-height'], 'rounded': ['border-radius'], 'tracking': ['letter-spacing'],
             'min-h': ['min-height'], 'min-w': ['min-width'], 'max-w': ['max-width'], 'max-h': ['max-height']}[k]
        return ';'.join(f'{p}:{v}' for p in P)
    m = re.fullmatch(r'bg-\[(.+)\]', c)
    if m: return 'background-color:' + us(m.group(1))
    m = re.fullmatch(r'border-\[(.+)\]', c)
    if m: return 'border-color:' + us(m.group(1))
    m = re.fullmatch(r'text-\[(.+)\]', c)
    if m:
        v = us(m.group(1)); return ('color:' if isColor(v) else 'font-size:') + v
    m = re.fullmatch(r'opacity-(\d+)', c)
    if m: return 'opacity:' + str(int(m.group(1)) / 100)
    m = re.fullmatch(r'drop-shadow-\[(.+)\]', c)
    if m: return 'filter:drop-shadow(' + us(m.group(1)) + ')'
    m = re.fullmatch(r'\[([a-z-]+):(.+)\]', c)
    if m: return m.group(1) + ':' + us(m.group(2))
    return None

used = {}
unknown = set()
LIT = re.compile(r'"([^"\n]*)"|`([^`]*)`|\'([^\'\n]*)\'')
for f in glob.glob(f'{root}/src/**/*.ts*', recursive=True):
    src = open(f).read()
    for m in LIT.finditer(src):
        for c in (m.group(1) or m.group(2) or m.group(3) or '').split():
            c = c.strip("'}{,")
            d = decl(c)
            if d: used[c] = d
    for m in re.finditer(r'className=(?:"([^"]*)"|\{`([^`]*)`\})', src):
        for c in (m.group(1) or m.group(2) or '').split():
            c = c.strip("'}{,")
            if not decl(c) and re.search(r'[\[\]]|^(flex|items|justify|gap|px|py|bg|text|border|rounded|font|leading|size|w|h)-', c): unknown.add(c)
out = ['/* GENERATED by tools/gen_css.py from the class names used in src/. Do not edit by hand. */']
for c in sorted(used): out.append(f'.{esc(c)}{{{used[c]}}}')
open(f'{root}/src/styles/atomic.css', 'w').write('\n'.join(out) + '\n')
print('classes:', len(used), ' unknown:', sorted(unknown))
