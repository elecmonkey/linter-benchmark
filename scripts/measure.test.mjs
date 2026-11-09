import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { measureCommand, summarizeRss } from './measure.mjs';

async function withFiles(callback) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-measure-test-'));
  try { return await callback({ cwd: dir, stdoutFile: path.join(dir, 'out'), stderrFile: path.join(dir, 'err'), timeoutMs: 5000 }); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('a command ending before the sampling interval has unknown RSS, not a failure', async () => {
  await withFiles(async (files) => {
    let calls = 0;
    const result = await measureCommand([process.execPath, '-e', 'process.stdout.write("ok")'], {
      ...files, sampleMs: 1000, sampler: { sample() { calls++; return Promise.resolve(100); } },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.timedOut, false);
    assert.equal(calls, 0);
    assert.equal(result.peakRssMb, null);
    assert.equal(fs.readFileSync(files.stdoutFile, 'utf8'), 'ok');
    assert.deepEqual(summarizeRss([result]), { median: null, max: null, sampledRuns: 0 });
  });
});

test('an in-flight RSS sample is retained without extending the measured wall time', async () => {
  await withFiles(async (files) => {
    const start = performance.now();
    const result = await measureCommand([process.execPath, '-e', 'setTimeout(() => {}, 30)'], {
      ...files, sampleMs: 5,
      sampler: { sample: () => new Promise((resolve) => setTimeout(() => resolve(128 * 1024), 500)) },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.peakRssMb, 128);
    assert(performance.now() - start - result.wallMs > 200);
  });
});

test('RSS summary uses only observations and sampler errors remain errors', async () => {
  assert.deepEqual(summarizeRss([{ peakRssMb: null }, { peakRssMb: 10 }, { peakRssMb: 20 }]), { median: 15, max: 20, sampledRuns: 2 });
  await withFiles(async (files) => {
    await assert.rejects(measureCommand([process.execPath, '-e', 'setTimeout(() => {}, 30)'], {
      ...files, sampleMs: 5, sampler: { sample: () => Promise.reject(new Error('sampler failed')) },
    }), /sampler failed/);
  });
});
