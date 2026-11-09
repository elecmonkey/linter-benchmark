import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { FIXTURES, ROOT, readJson, writeJson } from './lib.mjs';
import { PUBLICATION, GENERATED_PATHS } from './ci-contract.mjs';

export function validateResult(result, { group, fixture, tool, files, startedAt, ciRunId }) {
  const context = `${group}/${fixture}/${tool}`;
  const fail = (reason) => { throw new Error(`${context}: ${reason}`); };
  if (!Number.isFinite(Date.parse(startedAt)) || !ciRunId) fail('missing workflow provenance');
  if (result.group !== group || result.fixture !== fixture || result.tool !== tool) fail('wrong result identity');
  if (!result.scopeMatch || result.files !== files || result.filesLinted !== files) fail('file scope mismatch');
  if (!Number.isFinite(Date.parse(result.completedAt)) || Date.parse(result.completedAt) < Date.parse(startedAt)) fail('stale or missing completion time');
  if (result.ciRunId !== ciRunId) fail('result belongs to another workflow run');
  if (result.measurement?.runs !== 5 || result.measurement?.warmup !== 1 || result.runs?.length !== 5) fail('expected one warmup and five measurements');
  if (result.failedRuns || result.diagnostics?.error || !Number.isInteger(result.diagnostics?.total)) fail('tool failed or output was not parsed');
  if (result.measurement.rssSampleMs !== 50) fail('unexpected RSS sampling interval');
  if (tool.startsWith('oxlint-tsrs') && result.environment?.TSRS_FAST !== (tool.endsWith('-fast') ? '1' : '0')) fail('wrong tsrs preset');
  for (const run of result.runs) {
    if (![0, 1].includes(run.exitCode) || run.signal || run.timedOut) fail('unsuccessful measurement');
    if (!Number.isFinite(run.wallMs) || run.wallMs <= 0 || run.peakRssMb !== null && (!Number.isFinite(run.peakRssMb) || run.peakRssMb < 0)) fail('invalid timing or RSS');
  }
  if (!Number.isFinite(result.wallMs?.median) || result.wallMs.median <= 0) fail('missing timing samples');
  const rss = result.peakRssMb?.median;
  if (rss !== null && (!Number.isFinite(rss) || rss < 0)) fail('invalid RSS samples');
}

export function validateDirectory(root = ROOT) {
  const environment = readJson(path.join(root, 'results/environment.json'));
  const groups = readJson(path.join(root, 'rules/groups.json'));
  const scope = readJson(path.join(root, 'scope/summary.json'));
  const expectedTools = {
    A: ['rslint', 'oxlint-tsgolint', 'oxlint-tsrs', 'oxlint-tsrs-fast'],
    B: ['rslint', 'oxlint-tsgolint', 'oxlint-tsrs', 'oxlint-tsrs-fast', 'biome'],
    C: ['rslint', 'oxlint', 'biome'],
  };
  if (JSON.stringify(Object.keys(groups).sort()) !== JSON.stringify(Object.keys(expectedTools))) throw new Error('CI must cover exactly A/B/C');
  for (const [group, tools] of Object.entries(expectedTools)) {
    if (JSON.stringify(groups[group].tools) !== JSON.stringify(tools) || groups[group].typeInfo !== (group !== 'C')) throw new Error(`unexpected comparator definition for group ${group}`);
  }
  let count = 0;
  for (const [group, def] of Object.entries(groups)) {
    for (const fixture of FIXTURES) {
      const dir = path.join(root, 'results/raw', `group-${group.toLowerCase()}`, fixture);
      const actual = fs.readdirSync(dir).filter((file) => file.endsWith('.json')).sort();
      const expected = def.tools.map((tool) => `${tool}.json`).sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${group}/${fixture}: missing or unexpected results`);
      for (const tool of def.tools) {
        validateResult(readJson(path.join(dir, `${tool}.json`)), {
          group, fixture, tool, files: scope[fixture].files,
          startedAt: environment.startedAt, ciRunId: environment.ciRunId,
        });
        count++;
      }
    }
  }
  if (count !== 108) throw new Error(`expected 108 comparator results, got ${count}`);
  return count;
}

function prepare() {
  if (process.env.GITHUB_REPOSITORY !== PUBLICATION.repository || process.env.GITHUB_REF !== `refs/heads/${PUBLICATION.base}`) throw new Error('CI must run from this repository main branch');
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const totalMemory = os.totalmem();
  const disk = fs.statfsSync(ROOT);
  if (totalMemory < 14 * 1024 ** 3) throw new Error('Benchmark needs at least 14 GiB RAM; select a larger or dedicated runner. 32 GiB or more is recommended.');
  if (disk.bavail * disk.bsize < 6 * 1024 ** 3) throw new Error('Benchmark needs at least 6 GiB free disk space after installing fixtures');
  for (const dir of ['results/raw', 'results/charts']) fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });
  writeJson(path.join(ROOT, 'results/environment.json'), {
    startedAt: new Date().toISOString(), sourceCommit,
    ciRunId: `${process.env.GITHUB_RUN_ID}/${process.env.GITHUB_RUN_ATTEMPT}`,
    runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    os: os.type(), release: os.release(), arch: os.arch(),
    cpuModel: os.cpus()[0]?.model ?? 'unknown', cpuCount: os.availableParallelism(),
    memoryGiB: Math.round(totalMemory / 1024 ** 3),
    node: process.version, pnpm: execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim(),
  });
  // The always-uploaded logs include a second copy of exact result JSON and
  // its inputs, even if a later validation or artifact upload fails.
  const checkpoint = path.join(ROOT, 'logs/benchmark-checkpoint');
  fs.rmSync(checkpoint, { recursive: true, force: true });
  for (const file of [...GENERATED_PATHS.filter((file) => file !== 'results'), 'results/environment.json']) {
    const target = path.join(checkpoint, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(ROOT, file), target, { recursive: true });
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## Benchmark publication preview\n\nRepository: ${PUBLICATION.repository}\n\nBase: ${PUBLICATION.base}\n\nHead: ${PUBLICATION.branch}\n\nCommit message: ${PUBLICATION.commitMessage}\nPR title: ${PUBLICATION.title}\n\nPR body:\n\n${PUBLICATION.body}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === 'prepare') prepare();
  else if (command === 'validate') console.log(`Validated ${validateDirectory()} fresh results and 540 measured runs`);
  else throw new Error('usage: node scripts/ci-results.mjs prepare|validate');
}
