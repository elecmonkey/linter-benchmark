// Shared paths and helpers for the benchmark scripts.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const BIN = path.join(ROOT, 'node_modules', '.bin');
export const FIXTURE_DIR = path.join(ROOT, 'fixture');
export const RULES_DIR = path.join(ROOT, 'rules');
export const SCOPE_DIR = path.join(ROOT, 'scope');
export const CONFIGS_DIR = path.join(ROOT, 'configs');
export const RESULTS_DIR = path.join(ROOT, 'results');
export const LOGS_DIR = path.join(ROOT, 'logs');

export const REPOS = [
  'web-infra-dev/rsbuild',
  'web-infra-dev/rslib',
  'rstackjs/rstack-cli',
  'web-infra-dev/rstest',
  'web-infra-dev/rsdoctor',
  'web-infra-dev/rspress',
];
export const FIXTURES = REPOS.map((repo) => repo.split('/')[1]);

export const TS_PREFIX = '@typescript-eslint/';

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Run a command synchronously; returns { status, stdout, stderr }. */
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 1 << 30, ...options });
  if (result.error) throw result.error;
  return result;
}

/** Parse `--key value` / `--key=value` CLI flags into an object of comma lists. */
export function parseFlags(argv = process.argv.slice(2)) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const [key, inline] = argv[i].replace(/^--/, '').split('=');
    flags[key] = inline ?? argv[++i];
  }
  return flags;
}

export const list = (value, fallback) => (value ? value.split(',') : fallback);
