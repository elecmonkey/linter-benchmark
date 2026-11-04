// Step 7: draw ranking bar charts from results/raw as static SVG.
//
// One chart per group x fixture; the README section around it supplies the
// heading. Bars are sorted fastest first. Each bar carries the tool name on
// the left, "N.NN×" relative to the fastest tool inside the bar (white, bold;
// the fastest shows 1.00×) and its time after the bar end.
//
// Bar length is log-scaled on the ratio to the fastest tool, starting from a
// minimum length that fits the ratio label, so every ratio fits inside its
// bar. Order and relative size are preserved; exact values are in the labels.
//
// Colors follow the tool, never its rank, in fixed categorical order. The SVG
// follows the viewer's light/dark scheme via prefers-color-scheme.
//
// Output: results/charts/group-<g>-<fixture>.svg
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURES, RESULTS_DIR, RULES_DIR, readJson } from './lib.mjs';

const TOOLS = {
  eslint: { name: 'ESLint', light: '#2a78d6', dark: '#3987e5' },
  rslint: { name: 'Rslint', light: '#eb6834', dark: '#d95926' },
  oxlint: { name: 'Oxlint', light: '#1baf7a', dark: '#199e70' },
  biome: { name: 'Biome', light: '#eda100', dark: '#c98500' },
};
const SURFACE = { light: '#fcfcfb', dark: '#1a1a19' };
const TEXT = { light: { primary: '#0b0b0b', secondary: '#52514e' }, dark: { primary: '#f0efec', secondary: '#c3c2b7' } };
const RATIO_INK = '#ffffff';

// ------------------------------------------------------------------ layout
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const W = 760;
const LABEL_W = 110; // tool names, right-aligned
const BAR_X = LABEL_W + 16;
const VALUE_W = 90; // room for the time label after the longest bar
const BAR_MAX = W - BAR_X - VALUE_W;
const BAR_H = 24;
const ROW_GAP = 14;
const PAD = 16;
const charWidth = (fontSize) => fontSize * 0.6; // conservative estimate for layout
const RATIO_FONT = 13;
const BAR_MIN = Math.ceil(charWidth(RATIO_FONT) * '00.00×'.length + 20); // fits the widest ratio label

const fmtTime = (ms) => (ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Horizontal bar: square at the baseline (left), 4px rounded data-end (right). */
function barPath(x, y, w, h, r = 4) {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x},${y}H${x + w - rr}A${rr},${rr} 0 0 1 ${x + w},${y + rr}V${y + h - rr}A${rr},${rr} 0 0 1 ${x + w - rr},${y + h}H${x}Z`;
}

function renderChart({ label, rows }) {
  const sorted = [...rows].sort((a, b) => a.ms - b.ms);
  const fastest = sorted[0].ms;
  const maxLog = Math.log(sorted.at(-1).ms / fastest) || 1;
  const width = (ms) => BAR_MIN + (BAR_MAX - BAR_MIN) * (Math.log(ms / fastest) / maxLog);
  const H = PAD + sorted.length * (BAR_H + ROW_GAP) - ROW_GAP + PAD;

  const style = `
    .surface { fill: ${SURFACE.light}; }
    .t-primary { fill: ${TEXT.light.primary}; }
    .t-secondary { fill: ${TEXT.light.secondary}; }
    .ratio { fill: ${RATIO_INK}; }
    ${Object.entries(TOOLS)
      .map(([id, t]) => `.bar-${id} { fill: ${t.light}; }`)
      .join('\n    ')}
    @media (prefers-color-scheme: dark) {
      .surface { fill: ${SURFACE.dark}; }
      .t-primary { fill: ${TEXT.dark.primary}; }
      .t-secondary { fill: ${TEXT.dark.secondary}; }
      ${Object.entries(TOOLS)
        .map(([id, t]) => `.bar-${id} { fill: ${t.dark}; }`)
        .join('\n      ')}
    }`;

  const body = sorted.map((row, i) => {
    const y = PAD + i * (BAR_H + ROW_GAP);
    const w = width(row.ms);
    const cy = y + BAR_H / 2;
    const ratio = row.ms / fastest;
    const ratioText = `${ratio.toFixed(2)}×`;
    const name = TOOLS[row.tool].name;
    const label = `${name}: ${fmtTime(row.ms)} (${i > 0 ? `${ratioText} the fastest` : 'fastest'})`;
    const valueText = fmtTime(row.ms);
    return `
  <g>
    <title>${esc(label)}</title>
    <text class="t-secondary" x="${LABEL_W}" y="${cy}" text-anchor="end" dominant-baseline="central" font-size="15">${esc(name)}</text>
    <path class="bar-${row.tool}" d="${barPath(BAR_X, y, w, BAR_H)}"/>
    <text class="ratio" x="${BAR_X + w - 8}" y="${cy}" text-anchor="end" dominant-baseline="central" font-size="${RATIO_FONT}" font-weight="700">${ratioText}</text>
    <text class="t-secondary" x="${BAR_X + w + 10}" y="${cy}" dominant-baseline="central" font-size="14">${esc(valueText)}</text>
  </g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" role="img" aria-label="${esc(label)}">
  <style>${style}
  </style>
  <rect class="surface" width="${W}" height="${H}" rx="8"/>
${body.join('')}
</svg>
`;
}

// ------------------------------------------------------------------ data
const groups = readJson(path.join(RULES_DIR, 'groups.json'));
const load = (group, fixture, tool) => {
  const file = path.join(RESULTS_DIR, 'raw', `group-${group.toLowerCase()}`, fixture, `${tool}.json`);
  return fs.existsSync(file) ? readJson(file) : null;
};

const outDir = path.join(RESULTS_DIR, 'charts');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const [group, def] of Object.entries(groups)) {
  for (const fixture of FIXTURES) {
    const rows = def.tools.map((tool) => ({ tool, ms: load(group, fixture, tool)?.wallMs.median }));
    if (rows.some((r) => r.ms == null)) {
      console.warn(`group ${group} / ${fixture}: incomplete results, no chart`);
      continue;
    }
    const svg = renderChart({ label: `Group ${group}, ${fixture}: median wall time, lower is better`, rows });
    fs.writeFileSync(path.join(outDir, `group-${group.toLowerCase()}-${fixture}.svg`), svg);
  }
}

console.log(fs.readdirSync(outDir).join('\n'));
