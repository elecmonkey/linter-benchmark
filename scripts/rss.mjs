import { spawn, execFile } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function createRssSampler() {
  if (process.platform !== 'darwin') {
    return {
      method: 'ps',
      ready: Promise.resolve(),
      close() {},
      async sample(rootPid) {
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
      },
    };
  }

  const child = spawn('python3', [fileURLToPath(new URL('./rss-darwin.py', import.meta.url))], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const pending = new Map();
  let sequence = 0;
  let failure;
  let closing = false;
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const fail = (error) => {
    failure = error;
    rejectReady(error);
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  child.on('error', fail);
  child.on('close', (code) => {
    if (!closing || code !== 0 || pending.size) fail(new Error(`RSS sampler exited with code ${code}`));
  });
  child.stdin.on('error', fail);
  createInterface({ input: child.stdout }).on('line', (line) => {
    try {
      const response = JSON.parse(line);
      if (response.ready) return resolveReady();
      const request = pending.get(response.id);
      if (!request) return;
      pending.delete(response.id);
      if (response.error) request.reject(new Error(response.error));
      else request.resolve(response.kb);
    } catch (error) { fail(error); }
  });
  return {
    method: 'libproc', ready,
    close() { closing = true; child.stdin.end(); },
    async sample(pid) {
      await ready;
      if (failure) throw failure;
      return new Promise((resolve, reject) => {
        const id = sequence++;
        pending.set(id, { resolve, reject });
        child.stdin.write(`${JSON.stringify({ id, pid })}\n`);
      });
    },
  };
}
