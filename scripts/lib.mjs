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
  'web-infra-dev/rspack',
  'microsoft/vscode',
  'microsoft/TypeScript',
];
// microsoft/TypeScript is pinned to its last 6.x release, not the current repository.
const NAME_OVERRIDES = { 'microsoft/TypeScript': 'typescript6' };

/** Fixture directory name: the repository name, lowercased, unless overridden. */
export const fixtureName = (repo) => NAME_OVERRIDES[repo] ?? repo.split('/')[1].toLowerCase();
export const FIXTURES = REPOS.map(fixtureName);

export const TS_PREFIX = '@typescript-eslint/';

// Stable comparator IDs, labels and rule namespaces shared by every step.
export const TOOL_META = {
  rslint: { name: 'Rslint', light: '#eb6834', dark: '#d95926' },
  oxlint: { name: 'Oxlint', light: '#1baf7a', dark: '#199e70' },
  'oxlint-tsgolint': { name: 'Oxlint (tsgolint)', ruleTool: 'oxlint', typedOnly: true, light: '#1baf7a', dark: '#199e70' },
  'oxlint-tsrs': { name: 'Oxlint (tsrs)', ruleTool: 'oxlint', typedOnly: true, light: '#9362cc', dark: '#a47ad7' },
  'oxlint-tsrs-fast': { name: 'Oxlint (tsrs --fast)', ruleTool: 'oxlint', typedOnly: true, light: '#247eab', dark: '#3b94bd' },
  biome: { name: 'Biome', light: '#eda100', dark: '#c98500' },
};

export function toolMeta(tool) {
  if (!Object.hasOwn(TOOL_META, tool)) throw new Error(`unknown benchmark tool: ${tool}`);
  return TOOL_META[tool];
}
export const toolName = (tool) => toolMeta(tool).name;

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
  // pnpm run forwards its argument separator to the script in pnpm 12.
  if (argv[0] === '--') argv = argv.slice(1);
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const [key, inline] = argv[i].replace(/^--/, '').split('=');
    flags[key] = inline ?? argv[++i];
  }
  return flags;
}

export const list = (value, fallback) => (value ? value.split(',') : fallback);

// Engine variants share Oxlint's rule set and configuration.
export const ruleTool = (tool) => toolMeta(tool).ruleTool ?? tool;
export function toolsForGroup(def, selected) {
  for (const tool of [...def.tools, ...(selected ?? [])]) toolMeta(tool);
  if (!def.typeInfo && def.tools.some((tool) => toolMeta(tool).typedOnly)) {
    throw new Error('a group without type information cannot include a type-aware engine');
  }
  return selected ? def.tools.filter((tool) => selected.includes(tool)) : [...def.tools];
}
