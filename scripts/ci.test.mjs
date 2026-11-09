import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { validateResult } from './ci-results.mjs';
import { PUBLICATION, GENERATED_PATHS, isGeneratedPath, assertPullRequest } from './ci-contract.mjs';

const context = { group: 'A', fixture: 'sample', tool: 'oxlint-tsrs-fast', files: 2, startedAt: '2026-01-01T00:00:00Z', ciRunId: '123/1' };
const valid = () => ({
  group: 'A', fixture: 'sample', tool: 'oxlint-tsrs-fast', files: 2, filesLinted: 2, scopeMatch: true,
  completedAt: '2026-01-01T00:01:00Z', ciRunId: '123/1',
  measurement: { runs: 5, warmup: 1, rssSampleMs: 50 }, environment: { TSRS_FAST: '1' },
  failedRuns: 0, diagnostics: { total: 1 }, wallMs: { median: 100 }, peakRssMb: { median: 100 },
  runs: Array.from({ length: 5 }, () => ({ exitCode: 1, signal: null, timedOut: false, wallMs: 100, peakRssMb: 100 })),
});

test('CI accepts diagnostics exit codes but rejects stale, incomplete and failed data', () => {
  assert.doesNotThrow(() => validateResult(valid(), context));
  for (const mutate of [
    (r) => { r.completedAt = '2025-12-31T23:59:00Z'; },
    (r) => { r.ciRunId = '122/1'; },
    (r) => { r.runs.pop(); },
    (r) => { r.scopeMatch = false; },
    (r) => { r.filesLinted = 3; },
    (r) => { r.environment.TSRS_FAST = '0'; },
    (r) => { r.diagnostics.error = 'invalid JSON'; },
    (r) => { r.runs[0].exitCode = 2; },
    (r) => { r.runs[0].timedOut = true; },
    (r) => { r.runs[0].signal = 'SIGKILL'; },
    (r) => { r.peakRssMb.median = 0; },
  ]) {
    const result = valid(); mutate(result);
    assert.throws(() => validateResult(result, context));
  }
});

test('publication is restricted to generated data and exact same-repository PR text', () => {
  for (const file of GENERATED_PATHS) assert(isGeneratedPath(file));
  for (const file of ['package.json', 'scripts/05-run.mjs', '.github/workflows/benchmark.yml', 'rules/catalog.json', 'results/../../.git/config']) assert(!isGeneratedPath(file));
  const pr = {
    title: PUBLICATION.title, body: PUBLICATION.body,
    head: { ref: PUBLICATION.branch, repo: { full_name: PUBLICATION.repository } },
    base: { ref: PUBLICATION.base, repo: { full_name: PUBLICATION.repository } },
  };
  assert.doesNotThrow(() => assertPullRequest(pr));
  assert.throws(() => assertPullRequest({ ...pr, body: PUBLICATION.body + 'Extra text' }));
  assert.throws(() => assertPullRequest({ ...pr, head: { ...pr.head, repo: { full_name: 'another/fork' } } }));
  assert(/^[\x00-\x7F]*$/.test(PUBLICATION.title + PUBLICATION.body + PUBLICATION.commitMessage));
});

test('manual dispatch approval displays the exact publication text', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/benchmark.yml'), 'utf8');
  const approval = workflow.split('      publish_results:')[1].split('        required:')[0];
  const description = approval.split('        description: |\n')[1].split('\n').map((line) => line.replace(/^ {10}/, '')).join('\n');
  assert(description.includes(`Title and commit: ${PUBLICATION.title}\n`));
  assert.equal(description.split('PR body:\n')[1], PUBLICATION.body);
  assert(description.includes(`pushing ${PUBLICATION.branch}`));
  assert(description.includes(`PR to ${PUBLICATION.base}`));
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert(readme.includes(PUBLICATION.body));
});
