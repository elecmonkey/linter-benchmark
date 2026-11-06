// Step 5: run the benchmark.
//
// For every group x fixture, the configs from configs/group-<g>/<fixture>/ are
// copied into the fixture root, then each tool lints the fixture root; the
// config selects the scope. Afterwards the number of files each tool actually
// linted is checked against scope/<fixture>.txt (`filesLinted`, `scopeMatch`).
// Per tool: 1 warmup run, then N measured runs, interleaved across tools so
// machine drift affects every tool equally. Each run records wall time and the
// peak RSS summed over the whole process tree (Node launchers + native
// binaries + tsgolint), sampled every 50 ms with `ps`.
// Diagnostics from the last run are parsed and counted per ESLint rule name.
//
// Safety: each run is killed (whole process group) after --timeout-min minutes
// and recorded as a timeout. ESLint gets a 32 GB V8 heap: typed linting with
// projectService exceeds Node's ~4 GB default on multi-tsconfig monorepos.
//
// Usage:
//   node scripts/05-run.mjs [--groups A,B,C] [--fixtures rsbuild,...] [--tools eslint,...]
//                           [--runs 5] [--warmup 1] [--timeout-min 15] [--eslint-heap-mb 32768]
//
// Output: results/raw/group-<g>/<fixture>/<tool>.json
//         logs/output/group-<g>/<fixture>/<tool>.{stdout,stderr} (last run)
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { BIN, CONFIGS_DIR, FIXTURES, FIXTURE_DIR, LOGS_DIR, RESULTS_DIR, RULES_DIR, SCOPE_DIR, list, parseFlags, readJson, writeJson } from './lib.mjs';

const flags = parseFlags();
const GROUPS = list(flags.groups, ['A', 'B', 'C']);
const SELECTED_FIXTURES = list(flags.fixtures, FIXTURES);
const RUNS = Number(flags.runs ?? 5);
const WARMUP = Number(flags.warmup ?? 1);
const TIMEOUT_MS = Number(flags['timeout-min'] ?? 15) * 60_000;
const ESLINT_HEAP_MB = Number(flags['eslint-heap-mb'] ?? 32768);
const groups = readJson(path.join(RULES_DIR, 'groups.json'));

// ------------------------------------------------------------------ tools
// `config` is the file in configs/group-<g>/<fixture>/; `as` is its name inside the fixture.
// `args(typeInfo)` is false for groups that run without type information.
// `linted(stdout, cwd)` returns the files the tool linted: a list, or a count.
const TOOLS = {
  eslint: {
    config: 'eslint.config.mjs',
    as: 'eslint.config.bench.mjs',
    env: { NODE_OPTIONS: `--max-old-space-size=${ESLINT_HEAP_MB}` },
    args: () => [path.join(BIN, 'eslint'), '-c', 'eslint.config.bench.mjs', '--format', 'json', '.'],
    parse: (out) => JSON.parse(out).flatMap((file) => file.messages.map((m) => m.ruleId ?? `fatal: ${m.message}`)),
    linted: (out, cwd) => JSON.parse(out).map((file) => path.relative(cwd, file.filePath)),
  },
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
    env: { OXLINT_TSGOLINT_PATH: path.join(BIN, 'tsgolint') },
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

// Map a tool-specific rule name back to the ESLint rule name(s) of the group.
function ruleIndex(group, tool) {
  const index = new Map();
  for (const rule of groups[group].rules) {
    const key = rule[tool];
    index.set(key, index.has(key) ? `${index.get(key)} + ${rule.eslint}` : rule.eslint);
  }
  return index;
}

// ------------------------------------------------------------------ measuring
const execFileAsync = promisify(execFile);

async function treeRssKb(rootPid) {
  const { stdout } = await execFileAsync('ps', ['-A', '-o', 'pid=,ppid=,rss=']);
  const children = new Map();
  const rss = new Map();
  for (const line of stdout.trim().split('\n')) {
    const [pid, ppid, kb] = line.trim().split(/\s+/).map(Number);
    rss.set(pid, kb);
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(pid);
  }
  let total = 0;
  const stack = [rootPid];
  while (stack.length) {
    const pid = stack.pop();
    total += rss.get(pid) ?? 0;
    stack.push(...(children.get(pid) ?? []));
  }
  return total;
}

function runOnce(argv, { cwd, env, stdoutFile, stderrFile }) {
  return new Promise((resolve, reject) => {
    const stdout = fs.openSync(stdoutFile, 'w');
    const stderr = fs.openSync(stderrFile, 'w');
    const start = process.hrtime.bigint();
    // detached: own process group, so a timeout can kill launcher + native children.
    const child = spawn(argv[0], argv.slice(1), { cwd, env: { ...process.env, ...env }, stdio: ['ignore', stdout, stderr], detached: true });
    let timedOut = false;
    const killer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
    }, TIMEOUT_MS);

    let peakKb = 0;
    let sampling = false;
    const timer = setInterval(async () => {
      if (sampling) return;
      sampling = true;
      try {
        peakKb = Math.max(peakKb, await treeRssKb(child.pid));
      } catch {}
      sampling = false;
    }, 50);

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      const wallMs = Number(process.hrtime.bigint() - start) / 1e6;
      clearInterval(timer);
      clearTimeout(killer);
      fs.closeSync(stdout);
      fs.closeSync(stderr);
      resolve({ wallMs, peakRssMb: peakKb / 1024, exitCode: code, signal, timedOut });
    });
  });
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
  const typed = new Set(groups[group].rules.filter((r) => r.typed).map((r) => r.eslint));
  const byRule = {};
  const unmapped = {};
  for (const name of names) {
    const eslintName = index.get(name);
    if (eslintName) byRule[eslintName] = (byRule[eslintName] ?? 0) + 1;
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
  process.exit(130);
});

for (const group of GROUPS) {
  const tools = groups[group].tools.filter((t) => SELECTED_TOOLS.includes(t));
  for (const fixture of SELECTED_FIXTURES) {
    const configDir = path.join(CONFIGS_DIR, `group-${group.toLowerCase()}`, fixture);
    const cwd = path.join(FIXTURE_DIR, fixture);
    const files = fs.readFileSync(path.join(SCOPE_DIR, `${fixture}.txt`), 'utf8').trim().split('\n');
    const outDir = path.join(LOGS_DIR, 'output', `group-${group.toLowerCase()}`, fixture);
    fs.mkdirSync(outDir, { recursive: true });

    try {
      for (const tool of tools) {
        const target = path.join(cwd, TOOLS[tool].as);
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
          console.log(`[${group}] ${fixture.padEnd(10)} ${tool.padEnd(6)} ${label.padEnd(6)} ${(result.wallMs / 1000).toFixed(2).padStart(7)}s ${result.peakRssMb.toFixed(0).padStart(6)} MB  exit=${result.exitCode ?? result.signal}${result.timedOut ? ' TIMEOUT' : ''}`);
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
        writeJson(path.join(RESULTS_DIR, 'raw', `group-${group.toLowerCase()}`, fixture, `${tool}.json`), {
          group,
          fixture,
          tool,
          files: files.length,
          ...scopeCheck,
          // A run that was killed (timeout / OOM signal) did not finish its work.
          failedRuns: runs[tool].filter((r) => r.timedOut || r.signal).length,
          command: spec.args(groups[group].typeInfo).map((a) => a.replace(`${BIN}/`, '')).join(' '),
          wallMs: { median: median(walls), mean: mean(walls), stdev: stdev(walls), min: Math.min(...walls), max: Math.max(...walls) },
          peakRssMb: { median: median(runs[tool].map((r) => r.peakRssMb)), max: Math.max(...runs[tool].map((r) => r.peakRssMb)) },
          runs: runs[tool],
          diagnostics,
        });
      }
    } finally {
      cleanup();
    }
  }
}
