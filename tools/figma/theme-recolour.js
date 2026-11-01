// Figma plugin script (run with the Figma MCP `use_figma` tool, or paste into a plugin console) that makes the
// male (blue and green) and female (pink) copies of SignScribe screens from the standard (teal) frames.
//
// It only swaps the profile colours of src/styles/tokens.css (page background and the accent family); everything else
// is left as it is. Run it on the page that holds the standard frames, in a file you can edit:
//   - SOURCE_PAGE: the page with the standard frames (the team file's "Screens" page is 0:1)
//   - each frame is cloned twice and placed below the originals, one row per profile, named "<name> — male" / "— female"
//   - screen 03's profile row is NOT changed by this script: copy it from the Phase II UI file
//     (https://www.figma.com/design/oBk8Xo9wJL2Uj9dyOUQd0h), where it is drawn from the running app.
// Keep this map in step with tokens.css (tests/contrast.test.ts checks the CSS side).

const SOURCE_PAGE = '0:1';
const MAPS = {
  male: { '#f8fafc': '#ecfeff', '#0f766e': '#1d4ed8', '#115e59': '#1e3a8a', '#ccfbf1': '#dbeafe', '#f0fdfa': '#eff6ff', '#5eead4': '#93c5fd' },
  female: { '#f8fafc': '#fff7fb', '#0f766e': '#be185d', '#115e59': '#9d174d', '#ccfbf1': '#fce7f3', '#f0fdfa': '#fdf2f8', '#5eead4': '#f9a8d4' },
};

const hexRGB = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const toHex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const swap = (paints, map) =>
  paints.map((p) => (p.type === 'SOLID' && map[toHex(p.color)] ? { ...p, color: hexRGB(map[toHex(p.color)]) } : p));
function recolour(root, map) {
  let changed = 0;
  for (const n of [root, ...root.findAll(() => true)]) {
    for (const key of ['fills', 'strokes']) {
      if (!(key in n) || !Array.isArray(n[key])) continue;
      const next = swap(n[key], map);
      if (JSON.stringify(next) !== JSON.stringify(n[key])) {
        n[key] = next;
        changed++;
      }
    }
  }
  return changed;
}

const page = await figma.getNodeByIdAsync(SOURCE_PAGE);
await figma.setCurrentPageAsync(page);
const frames = page.children.filter((n) => n.type === 'FRAME' && !/ — (male|female)$/.test(n.name));
const bottom = Math.max(...frames.map((f) => f.y + f.height));
const out = { male: [], female: [] };
Object.keys(MAPS).forEach((g, row) => {
  for (const f of frames) {
    const c = f.clone();
    page.appendChild(c);
    c.x = f.x;
    c.y = f.y + (bottom + 400) * (row + 1);
    c.name = `${f.name} — ${g}`;
    out[g].push({ id: c.id, recoloured: recolour(c, MAPS[g]) });
  }
});
return out;
