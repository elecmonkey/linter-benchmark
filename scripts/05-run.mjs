// Step 5: run the benchmark.
//
// For every group x fixture, the configs from configs/group-<g>/<fixture>/ are
// copied into the fixture root, then each tool lints the fixture root; the
// config selects the scope. Afterwards the number of files each tool actually
// linted is checked against scope/<fixture>.txt (`filesLinted`, `scopeMatch`).
// Per tool: 1 warmup run, then N measured runs, interleaved across tools so
// machine drift affects every tool equally. Each run records wall time and the
// peak RSS summed over the whole process tree (Node launchers + native
// binaries + type engine), sampled every 50 ms with libproc on macOS and ps elsewhere.
// Diagnostics from the last run are parsed and counted per baseline rule ID.
//
// Safety: each run is killed (whole process group) after --timeout-min minutes
// and recorded as a timeout.
//
// Usage:
//   node scripts/05-run.mjs [--groups A,B,C] [--fixtures rsbuild,...] [--tools rslint,oxlint-tsgolint,...]
//                           [--runs 5] [--warmup 1] [--timeout-min 15]
//
// Output: results/raw/group-<g>/<fixture>/<tool>.json
//         logs/output/group-<g>/<fixture>/<tool>.{stdout,stderr} (last run)
import fs from 'node:fs';
import path from 'node:path';
import { createRssSampler } from './rss.mjs';
import { measureCommand, summarizeRss } from './measure.mjs';
import { BIN, CONFIGS_DIR, FIXTURES, FIXTURE_DIR, LOGS_DIR, RESULTS_DIR, RULES_DIR, SCOPE_DIR, list, parseFlags, readJson, ruleTool, toolsForGroup, writeJson } from './lib.mjs';

const flags = parseFlags();
const GROUPS = list(flags.groups, ['A', 'B', 'C']);
const SELECTED_FIXTURES = list(flags.fixtures, FIXTURES);
const RUNS = Number(flags.runs ?? 5);
const WARMUP = Number(flags.warmup ?? 1);
const TIMEOUT_MS = Number(flags['timeout-min'] ?? 15) * 60_000;
const groups = readJson(path.join(RULES_DIR, 'groups.json'));
const allowedFlags = new Set(['groups', 'fixtures', 'tools', 'runs', 'warmup', 'timeout-min']);
for (const flag of Object.keys(flags)) {
  if (!allowedFlags.has(flag)) throw new Error(`unknown benchmark option: --${flag}`);
}
for (const group of GROUPS) {
  if (!Object.hasOwn(groups, group)) throw new Error(`unknown benchmark group: ${group}`);
}
for (const fixture of SELECTED_FIXTURES) {
  if (!FIXTURES.includes(fixture)) throw new Error(`unknown benchmark fixture: ${fixture}`);
}
if (!Number.isInteger(RUNS) || RUNS < 1 || !Number.isInteger(WARMUP) || WARMUP < 0 || !(TIMEOUT_MS > 0)) {
  throw new Error('runs must be positive, warmup nonnegative, and timeout positive');
}

// ------------------------------------------------------------------ tools
// `config` is the file in configs/group-<g>/<fixture>/; `as` is its name inside the fixture.
// `args(typeInfo)` is false for groups that run without type information.
// `linted(stdout, cwd)` returns the files the tool linted: a list, or a count.
const TOOLS = {
  rslint: {
    config: 'rslint.config.mjs',
    as: 'rslint.config.bench.mjs',
    args: () => [path.join(BIN, 'rslint'), '-c', 'rslint.config.bench.mjs', '--format', 'jsonline'],
    parse: (out) => out.split('\n').filter((line) => line.startsWith('{')).map((line) => JSON.parse(line).ruleName),
    // jsonline has no file count: one extra, untimed run with the default format prints "(N files, ...)".
    verifyArgs: () => [path.join(BIN, 'rslint'), '-c', 'rslint.config.bench.mjs', '--no-color', '--quiet'],
    linted: (out) => Number(/\((\d+) files?,/.exec(out)?.[1] ?? NaN),
  },
  oxlint: {
    config: 'oxlintrc.json',
    as: '.oxlintrc.bench.json',
    args: (typeInfo) => [path.join(BIN, 'oxlint'), '-c', '.oxlintrc.bench.json', ...(typeInfo ? ['--type-aware'] : []), '--disable-nested-config', '-f', 'json', '.'],
    // code: "typescript(no-floating-promises)" -> "typescript/no-floating-promises"
    parse: (out) => JSON.parse(out).diagnostics.map((d) => d.code?.replace(/^(\w+)\((.+)\)$/, '$1/$2') ?? `other: ${d.message}`),
    linted: (out) => JSON.parse(out).number_of_files,
  },
  biome: {
    config: 'biome.json',
    as: 'biome.json',
    args: () => [path.join(BIN, 'biome'), 'lint', '--reporter=json', '--max-diagnostics=none', '.'],
    // category: "lint/nursery/noFloatingPromises" -> "nursery/noFloatingPromises"
    parse: (out) => JSON.parse(out).diagnostics.map((d) => (d.category?.startsWith('lint/') ? d.category.slice(5) : `other: ${d.category}`)),
    // Biome's summary also counts its own biome.json as a processed file.
    linted: (out) => {
      const { changed, unchanged } = JSON.parse(out).summary;
      return changed + unchanged - 1;
    },
  },
};
TOOLS['oxlint-tsgolint'] = {
  ...TOOLS.oxlint,
  env: { OXLINT_TSGOLINT_PATH: path.join(BIN, 'tsgolint') },
};
TOOLS['oxlint-tsrs'] = {
  ...TOOLS.oxlint,
  env: { OXLINT_TSGOLINT_PATH: path.join(BIN, 'tsrs-lint'), TSRS_FAST: '0' },
};
TOOLS['oxlint-tsrs-fast'] = {
  ...TOOLS['oxlint-tsrs'],
  env: { ...TOOLS['oxlint-tsrs'].env, TSRS_FAST: '1' },
};

/** Compare what a tool linted with the scope: exact for file lists, by count otherwise. */
function checkScope(linted, scope) {
  if (Array.isArray(linted)) {
    const want = new Set(scope);
    const got = new Set(linted);
    const missing = scope.filter((f) => !got.has(f));
    const extra = linted.filter((f) => !want.has(f));
    return { filesLinted: linted.length, scopeMatch: !missing.length && !extra.length, missing: missing.slice(0, 20), extra: extra.slice(0, 20) };
  }
  return { filesLinted: linted, scopeMatch: linted === scope.length };
}
const SELECTED_TOOLS = list(flags.tools, Object.keys(TOOLS));
for (const group of GROUPS) {
  if (!toolsForGroup(groups[group], SELECTED_TOOLS).length) throw new Error(`no selected tools in group ${group}`);
}

// Map a tool-specific rule name back to the baseline rule ID(s) of the group.
function ruleIndex(group, tool) {
  const index = new Map();
  for (const rule of groups[group].rules) {
    const key = rule[ruleTool(tool)];
    index.set(key, index.has(key) ? `${index.get(key)} + ${rule.rule}` : rule.rule);
  }
  return index;
}

// ------------------------------------------------------------------ measuring
const rssSampler = createRssSampler();
await rssSampler.ready;

function runOnce(argv, options) {
  return measureCommand(argv, { ...options, sampler: rssSampler, timeoutMs: TIMEOUT_MS });
}

// ------------------------------------------------------------------ stats
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const stdev = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));

function summarizeDiagnostics(group, tool, names) {
  const index = ruleIndex(group, tool);
  const typed = new Set(groups[group].rules.filter((r) => r.typed).map((r) => r.rule));
  const byRule = {};
  const unmapped = {};
  for (const name of names) {
    const ruleId = index.get(name);
    if (ruleId) byRule[ruleId] = (byRule[ruleId] ?? 0) + 1;
    else unmapped[name] = (unmapped[name] ?? 0) + 1;
  }
  const count = (pred) => Object.entries(byRule).filter(([r]) => pred(r)).reduce((a, [, n]) => a + n, 0);
  return {
    total: names.length,
    typeAware: count((r) => typed.has(r)),
    syntactic: count((r) => !typed.has(r)),
    unmapped,
    byRule: Object.fromEntries(Object.entries(byRule).sort()),
  };
}

// ------------------------------------------------------------------ main
const placed = new Set();
const cleanup = () => {
  for (const file of placed) fs.rmSync(file, { force: true });
  placed.clear();
};
process.on('SIGINT', () => {
  cleanup();
  rssSampler.close();
  process.exit(130);
});

for (const group of GROUPS) {
  const tools = toolsForGroup(groups[group], SELECTED_TOOLS);
  for (const fixture of SELECTED_FIXTURES) {
    const configDir = path.join(CONFIGS_DIR, `group-${group.toLowerCase()}`, fixture);
    const cwd = path.join(FIXTURE_DIR, fixture);
    const files = fs.readFileSync(path.join(SCOPE_DIR, `${fixture}.txt`), 'utf8').trim().split('\n');
    const outDir = path.join(LOGS_DIR, 'output', `group-${group.toLowerCase()}`, fixture);
    fs.mkdirSync(outDir, { recursive: true });

    try {
      for (const tool of tools) {
        const target = path.join(cwd, TOOLS[tool].as);
        if (placed.has(target)) continue;
        if (fs.existsSync(target)) throw new Error(`refusing to overwrite ${target}`);
        fs.copyFileSync(path.join(configDir, TOOLS[tool].config), target);
        placed.add(target);
      }

      const runs = Object.fromEntries(tools.map((t) => [t, []]));
      const total = WARMUP + RUNS;
      for (let i = 0; i < total; i++) {
        for (const tool of tools) {
          const measured = i - WARMUP;
          const spec = TOOLS[tool];
          const result = await runOnce(spec.args(groups[group].typeInfo), {
            cwd,
            env: spec.env,
            stdoutFile: path.join(outDir, `${tool}.stdout`),
            stderrFile: path.join(outDir, `${tool}.stderr`),
          });
          const label = measured < 0 ? 'warmup' : `run ${measured + 1}`;
          console.log(`[${group}] ${fixture.padEnd(10)} ${tool.padEnd(6)} ${label.padEnd(6)} ${(result.wallMs / 1000).toFixed(2).padStart(7)}s ${(result.peakRssMb === null ? 'N/A' : result.peakRssMb.toFixed(0)).padStart(6)} MB  exit=${result.exitCode ?? result.signal}${result.timedOut ? ' TIMEOUT' : ''}`);
          if (measured >= 0) runs[tool].push(result);
        }
      }

      for (const tool of tools) {
        const spec = TOOLS[tool];
        const stdout = fs.readFileSync(path.join(outDir, `${tool}.stdout`), 'utf8');
        let diagnostics;
        let scopeCheck = { filesLinted: null, scopeMatch: false };
        try {
          diagnostics = summarizeDiagnostics(group, tool, spec.parse(stdout));
          let lintedOut = stdout;
          if (spec.verifyArgs) {
            const verifyFile = path.join(outDir, `${tool}.verify`);
            await runOnce(spec.verifyArgs(), { cwd, env: spec.env, stdoutFile: verifyFile, stderrFile: `${verifyFile}.stderr` });
            lintedOut = fs.readFileSync(verifyFile, 'utf8') + fs.readFileSync(`${verifyFile}.stderr`, 'utf8');
          }
          scopeCheck = checkScope(spec.linted(lintedOut, cwd), files);
        } catch (error) {
          diagnostics = { error: `could not parse output: ${error.message}` };
        }
        if (!diagnostics.error && !scopeCheck.scopeMatch) {
          console.log(`[${group}] ${fixture} ${tool}: SCOPE MISMATCH, linted ${scopeCheck.filesLinted} files, scope has ${files.length}`);
        }
        const walls = runs[tool].map((r) => r.wallMs);
        const result = {
          group,
          fixture,
          tool,
          ...(process.env.GITHUB_ACTIONS === 'true' ? { ciRunId: `${process.env.GITHUB_RUN_ID}/${process.env.GITHUB_RUN_ATTEMPT}` } : {}),
          completedAt: new Date().toISOString(),
          measurement: { runs: RUNS, warmup: WARMUP, rssMethod: rssSampler.method, rssSampleMs: 50 },
          environment: spec.env ?? {},
          files: files.length,
          ...scopeCheck,
          // A run that was killed (timeout / OOM signal) did not finish its work.
          failedRuns: runs[tool].filter((r) => r.timedOut || r.signal).length,
          command: spec.args(groups[group].typeInfo).map((a) => a.replace(`${BIN}/`, '')).join(' '),
          wallMs: { median: median(walls), mean: mean(walls), stdev: stdev(walls), min: Math.min(...walls), max: Math.max(...walls) },
          peakRssMb: summarizeRss(runs[tool]),
          runs: runs[tool],
          diagnostics,
        };
        writeJson(path.join(RESULTS_DIR, 'raw', `group-${group.toLowerCase()}`, fixture, `${tool}.json`), result);
        if (process.env.GITHUB_ACTIONS === 'true') {
          writeJson(path.join(LOGS_DIR, 'benchmark-checkpoint', 'results/raw', `group-${group.toLowerCase()}`, fixture, `${tool}.json`), result);
        }
      }
    } finally {
      cleanup();
    }
  }
}
rssSampler.close();
