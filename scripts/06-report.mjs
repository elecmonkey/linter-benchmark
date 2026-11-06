// Step 6: turn results/raw into the results section.
//
// For each group, and each fixture in it (smallest first): a heading, the
// file count, the ranking chart from 07-chart.mjs and a table. Relative =
// median wall time divided by the fastest tool's, matching the chart.
//
// The same section is written to results/report.md and into README.md
// between the <!-- results:start --> / <!-- results:end --> markers.
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURE_DIR, REPOS, RESULTS_DIR, ROOT, RULES_DIR, SCOPE_DIR, fixtureName, readJson } from './lib.mjs';

const groups = readJson(path.join(RULES_DIR, 'groups.json'));
const scope = readJson(path.join(SCOPE_DIR, 'summary.json'));
const manifestPath = path.join(FIXTURE_DIR, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;

const NAMES = {
  eslint: 'ESLint (typescript-eslint)',
  rslint: 'Rslint',
  oxlint: 'Oxlint (oxlint-tsgolint)',
  biome: 'Biome',
};
// Without type information Oxlint does not use tsgolint.
const nameIn = (def, tool) => (tool === 'oxlint' && !def.typeInfo ? 'Oxlint' : NAMES[tool]);
const REPO_OF = Object.fromEntries(REPOS.map((repo) => [fixtureName(repo), repo]));
const ORDER = Object.keys(REPO_OF).sort((a, b) => scope[a].files - scope[b].files);

const fmtTime = (ms) => (ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);
const fmtInt = (n) => n.toLocaleString('en-US');

function load(group, fixture, tool) {
  const file = path.join(RESULTS_DIR, 'raw', `group-${group.toLowerCase()}`, fixture, `${tool}.json`);
  return fs.existsSync(file) ? readJson(file) : null;
}

/** A run whose output could not be parsed produced no lint result: the tool crashed. */
const crashed = (r) => Boolean(r.diagnostics.error);

/** First internal-error message from the tool's last stderr, if the log is still around. */
function crashReason(group, fixture, tool) {
  const stderr = path.join(ROOT, 'logs', 'output', `group-${group.toLowerCase()}`, fixture, `${tool}.stderr`);
  if (!fs.existsSync(stderr)) return null;
  return /^Message: (.+)$/m.exec(fs.readFileSync(stderr, 'utf8'))?.[1] ?? null;
}

/** Markdown for the results section; `chartDir` is relative to the output file. */
function section(chartDir, headingLevel) {
  const h = (n) => '#'.repeat(headingLevel + n);
  const lines = [];

  // Wins: the fastest tool (median wall time) on each fixture.
  lines.push('| Group | Fastest tool (fixtures won) |', '|---|---|');
  for (const [group, def] of Object.entries(groups)) {
    const wins = {};
    let total = 0;
    for (const fixture of ORDER) {
      const rows = def.tools.map((tool) => ({ tool, r: load(group, fixture, tool) })).filter((x) => x.r);
      if (rows.length !== def.tools.length) continue;
      total++;
      const winner = rows.filter((x) => !crashed(x.r)).reduce((a, b) => (b.r.wallMs.median < a.r.wallMs.median ? b : a)).tool;
      (wins[winner] ??= []).push(fixture);
    }
    const cells = Object.entries(wins)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([tool, fixtures]) => `**${nameIn(def, tool)}** ${fixtures.length}/${total}`);
    lines.push(`| ${group} | ${cells.join(' · ')} |`);
  }
  lines.push('');

  for (const [group, def] of Object.entries(groups)) {
    lines.push(`${h(0)} Group ${group}: ${def.tools.map((t) => nameIn(def, t)).join(', ')}`, '');
    lines.push(`${def.typeInfo ? `${def.syntactic} syntactic + ${def.typeAware} type-aware rules` : `${def.syntactic} syntactic rules, no type information`}. Median of 5 runs after 1 warmup. Bar lengths are log-scaled; the labels give exact values.`, '');
    for (const fixture of ORDER) {
      const rows = def.tools.map((tool) => ({ tool, r: load(group, fixture, tool) })).filter((x) => x.r);
      if (rows.length !== def.tools.length) continue;
      // Crashed tools go last and take no part in the ranking.
      rows.sort((a, b) => crashed(a.r) - crashed(b.r) || a.r.wallMs.median - b.r.wallMs.median);
      const fastest = rows[0].r.wallMs.median;

      const sha = manifest?.repositories.find((r) => r.name === fixture)?.sha;
      const url = `https://github.com/${REPO_OF[fixture]}${sha ? `/tree/${sha}` : ''}`;
      lines.push(`${h(1)} [${fixture}](${url})`, '');
      lines.push(`**Files:** ${fmtInt(scope[fixture].files)}`, '');
      lines.push(`![Group ${group}, ${fixture}](${chartDir}/group-${group.toLowerCase()}-${fixture}.svg)`, '');
      lines.push('| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |');
      lines.push('|---|--:|--:|--:|--:|--:|--:|');
      const notes = [];
      for (const { tool, r } of rows) {
        if (crashed(r)) {
          lines.push(`| ${nameIn(def, tool)} | crashed | | | | | |`);
          const reason = crashReason(group, fixture, tool);
          // Double backticks: the message itself may contain backticks.
          notes.push(`${nameIn(def, tool)} crashed on every run and produced no lint output${reason ? `: internal error \`\` ${reason} \`\`` : ''}.`);
          continue;
        }
        const failed = r.failedRuns ? ` (${r.failedRuns} failed)` : '';
        lines.push(
          `| ${nameIn(def, tool)}${failed} | ${fmtTime(r.wallMs.median)} | ${fmtTime(r.wallMs.min)} | ${fmtTime(r.wallMs.max)} | ${fmtInt(Math.round(r.peakRssMb.median))} MB | ${fmtInt(r.diagnostics.total ?? 0)} | ${(r.wallMs.median / fastest).toFixed(2)}× |`,
        );
      }
      lines.push('');
      if (notes.length) lines.push(...notes, '');
    }
  }
  return lines.join('\n').trimEnd();
}

// results/report.md
fs.writeFileSync(path.join(RESULTS_DIR, 'report.md'), `# Results\n\n${section('charts', 2)}\n`);

// README.md
const readmePath = path.join(ROOT, 'README.md');
const readme = fs.readFileSync(readmePath, 'utf8');
const START = '<!-- results:start -->';
const END = '<!-- results:end -->';
if (!readme.includes(START) || !readme.includes(END)) throw new Error(`README.md lacks ${START} / ${END} markers`);
const generated = `${START}\n<!-- Generated by scripts/06-report.mjs. Do not edit by hand. -->\n\n## Results\n\n${section('results/charts', 3)}\n\n${END}`;
fs.writeFileSync(readmePath, readme.replace(new RegExp(`${START}[\\s\\S]*${END}`), generated));

console.log('wrote results/report.md and the README results section');
