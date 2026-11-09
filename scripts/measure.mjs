import { spawn } from 'node:child_process';
import fs from 'node:fs';

export function summarizeRss(runs) {
  const peaks = runs.map((run) => run.peakRssMb).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  const median = peaks.length ? (peaks.length % 2 ? peaks[(peaks.length - 1) / 2] : (peaks[peaks.length / 2 - 1] + peaks[peaks.length / 2]) / 2) : null;
  return { median, max: peaks.length ? peaks.at(-1) : null, sampledRuns: peaks.length };
}

export function measureCommand(argv, { cwd, env, stdoutFile, stderrFile, sampler, timeoutMs, sampleMs = 50 }) {
  return new Promise((resolve, reject) => {
    const stdout = fs.openSync(stdoutFile, 'w');
    const stderr = fs.openSync(stderrFile, 'w');
    const start = process.hrtime.bigint();
    const child = spawn(argv[0], argv.slice(1), { cwd, env: { ...process.env, ...env }, stdio: ['ignore', stdout, stderr], detached: true });
    let timedOut = false;
    let peakKb = 0;
    let pendingSample;
    let samplingError;
    let closed = false;
    const closeFiles = () => {
      if (closed) return;
      closed = true;
      fs.closeSync(stdout); fs.closeSync(stderr);
    };
    const killer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }, timeoutMs);
    const timer = setInterval(() => {
      if (pendingSample) return;
      pendingSample = Promise.resolve().then(() => sampler.sample(child.pid)).then((kb) => {
        if (!Number.isFinite(kb) || kb < 0) throw new Error('RSS sampler returned an invalid value');
        peakKb = Math.max(peakKb, kb);
      }).catch((error) => { samplingError = error; }).finally(() => { pendingSample = undefined; });
    }, sampleMs);
    child.once('error', (error) => {
      clearInterval(timer); clearTimeout(killer); closeFiles(); reject(error);
    });
    child.once('exit', async (code, signal) => {
      // Stop the wall clock at exit, even if the final RSS request is still in flight.
      const wallMs = Number(process.hrtime.bigint() - start) / 1e6;
      clearInterval(timer); clearTimeout(killer);
      await pendingSample;
      closeFiles();
      if (samplingError) return reject(samplingError);
      // A short process can exit before the first 50 ms sample. Zero is not its RSS.
      resolve({ wallMs, peakRssMb: peakKb > 0 ? peakKb / 1024 : null, exitCode: code, signal, timedOut });
    });
  });
}
