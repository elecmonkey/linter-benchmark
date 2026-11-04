// Step 0: check out the six fixture repositories (git submodules pinned to the
// benchmarked commits, shallow) and install their dependencies (type-aware
// linting needs them). Every fixture is installed
// with the same Node + pnpm as the benchmark, from its own frozen lockfile,
// with lifecycle scripts disabled.
//
// Output: fixture/<name>/, fixture/manifest.json, logs/install/<name>.log
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURE_DIR, LOGS_DIR, REPOS, ROOT, run, writeJson } from './lib.mjs';

fs.mkdirSync(path.join(LOGS_DIR, 'install'), { recursive: true });

const manifest = { node: process.version, pnpm: run('pnpm', ['-v']).stdout.trim(), repositories: [] };

for (const repo of REPOS) {
  const name = repo.split('/')[1];
  const dir = path.join(FIXTURE_DIR, name);

  if (!fs.existsSync(path.join(dir, '.git'))) {
    console.log(`checkout ${repo}`);
    const checkout = run('git', ['submodule', 'update', '--init', '--depth=1', `fixture/${name}`], { cwd: ROOT, stdio: 'inherit' });
    if (checkout.status !== 0) throw new Error(`submodule checkout failed: ${repo}`);
  }

  console.log(`install ${name}`);
  const install = run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], { cwd: dir });
  fs.writeFileSync(path.join(LOGS_DIR, 'install', `${name}.log`), install.stdout + install.stderr);
  if (install.status !== 0) throw new Error(`install failed: ${name} (see logs/install/${name}.log)`);

  manifest.repositories.push({ name, repository: repo, sha: run('git', ['rev-parse', 'HEAD'], { cwd: dir }).stdout.trim() });
}

writeJson(path.join(FIXTURE_DIR, 'manifest.json'), manifest);
console.table(manifest.repositories);
