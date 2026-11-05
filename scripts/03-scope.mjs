// Step 3: fix the set of files every tool lints, per fixture, and how to
// express it in tool configs.
//
// Scope = every file the repository runs its linter on:
//
//   1. JavaScript and TypeScript files (.js .jsx .mjs .cjs .ts .tsx .mts .cts,
//      .d.ts included) the tools would find on disk: git-tracked files plus
//      untracked ones outside node_modules;
//   2. minus the repository's global lint ignores (rstack.config.* `ignores` /
//      `globalIgnores`, eslint.config.*, vscode's .eslint-ignore) and minus
//      gitignored files.
//
// Type-aware rules run only on files a TypeScript project includes:
// projectService-style lookup (nearest tsconfig.json walking up, or a project
// it references) must find one. Every tool disables type-aware rules on the
// other files (`untyped`), so all of them do the same work.
//
// Each tool selects the scope through its own config (04-configs.mjs): JS/TS
// extensions, minus `ignores` (the repository's globs), minus `exclude` (exact
// paths of gitignored files), with an override turning type-aware rules off
// for `untyped` (directory globs where a whole directory is untyped, exact
// paths otherwise).
//
// Output: scope/<fixture>.txt   expected file list (checked after each run)
//         scope/<fixture>.json  { ignores, exclude, untyped } for the tool configs
//         scope/summary.json    file counts per stage
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { FIXTURES, FIXTURE_DIR, SCOPE_DIR, run, writeJson } from './lib.mjs';

// Global lint ignores, transcribed from each fixture's lint config.
const REPO_IGNORES = {
  rsbuild: ['e2e/cases/browser-logs/skip-build-error/src/index.js', 'e2e/cases/wasm/wasm-source-import/src/index.js'],
  rsdoctor: ['packages/core/tests/build/utils/bundles/**'],
  rslib: ['tests/integration/wasm/static-source/src/utils.js', 'tests/integration/wasm-inline/basic/src/source.js'],
  rspress: ['**/*.d.ts'],
  'rstack-cli': [],
  rstest: [],
  rspack: [
    'packages/rspack/src/runtime/moduleFederationDefaultRuntime.js',
    'xtask/benchmark/benches/fixtures/rspack_sources/**',
    '**/tests/**',
    'crates/rspack_resolver/**',
  ],
  vscode: { file: '.eslint-ignore' }, // read by eslint.config.js as global ignores
  typescript6: [
    '**/node_modules/**',
    'built/**',
    'tests/**',
    'lib/**',
    'src/lib/*.generated.d.ts',
    'scripts/**/*.js',
    'scripts/**/*.d.*',
    'internal/**',
    'coverage/**',
  ],
};

function repoIgnores(fixture, repoRoot) {
  const spec = REPO_IGNORES[fixture];
  if (Array.isArray(spec)) return spec;
  return fs
    .readFileSync(path.join(repoRoot, spec.file), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('!'));
}

const SOURCE = /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/;

/** tsconfig path -> { files: Set<abs path>, refs: [abs tsconfig path], ok } */
function createProjectLoader() {
  const cache = new Map();
  return function load(configPath) {
    if (cache.has(configPath)) return cache.get(configPath);
    let configError = false;
    const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => (configError = true),
    });
    // A tsconfig that fails to load (e.g. `extends` target missing) cannot
    // give type information to any tool.
    const ok = Boolean(parsed) && !configError && !parsed.errors.some((e) => e.code === 6053 /* file not found */);
    const project = {
      ok,
      files: new Set(ok ? parsed.fileNames.map((f) => path.resolve(f)) : []),
      refs: ok ? (parsed.projectReferences ?? []).map((r) => ts.resolveProjectReferencePath(r)).filter((p) => fs.existsSync(p)) : [],
    };
    cache.set(configPath, project);
    return project;
  };
}

/** projectService-style lookup: nearest tsconfig.json (or a project it references) that includes the file. */
function resolvesViaProjectService(file, repoRoot, load) {
  const includes = (configPath, seen = new Set()) => {
    if (seen.has(configPath)) return false;
    seen.add(configPath);
    const project = load(configPath);
    return project.files.has(file) || project.refs.some((ref) => includes(ref, seen));
  };
  for (let dir = path.dirname(file); dir.startsWith(repoRoot); dir = path.dirname(dir)) {
    const tsconfig = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(tsconfig) && includes(tsconfig)) return true;
    if (dir === repoRoot) break;
  }
  return false;
}

/**
 * Compress `untyped` files into globs: a directory whose scope files are all
 * untyped becomes `dir/**`; otherwise its untyped files are listed one by one.
 */
function compressUntyped(scope, untyped) {
  const root = { files: [], dirs: new Map() };
  for (const rel of scope) {
    const parts = rel.split('/');
    let node = root;
    for (const dir of parts.slice(0, -1)) {
      if (!node.dirs.has(dir)) node.dirs.set(dir, { files: [], dirs: new Map() });
      node = node.dirs.get(dir);
    }
    node.files.push(rel);
  }
  const allUntyped = (node) => node.files.every((f) => untyped.has(f)) && [...node.dirs.values()].every(allUntyped);
  const globs = [];
  const walk = (node, prefix) => {
    if (allUntyped(node)) {
      globs.push(prefix ? `${prefix}/**` : '**');
      return;
    }
    globs.push(...node.files.filter((f) => untyped.has(f)));
    for (const [dir, child] of node.dirs) walk(child, prefix ? `${prefix}/${dir}` : dir);
  };
  if (untyped.size) walk(root, '');
  return globs;
}

const summary = {};
for (const fixture of FIXTURES) {
  const repoRoot = path.join(FIXTURE_DIR, fixture);
  const ignores = repoIgnores(fixture, repoRoot);
  const load = createProjectLoader();
  const isSource = (f) => SOURCE.test(f) && !f.split('/').includes('node_modules');
  const git = (...args) => run('git', args, { cwd: repoRoot }).stdout.split('\n').filter(isSource);

  // Every JS/TS file a tool walking the repository would find.
  const onDisk = [...new Set([...git('ls-files'), ...git('ls-files', '--others')])].sort();
  const gitignored = new Set([...git('ls-files', '--cached', '--ignored', '--exclude-standard'), ...git('ls-files', '--others', '--ignored', '--exclude-standard')]);

  const scope = [];
  const exclude = []; // gitignored, not covered by `ignores`: excluded by exact path
  const untyped = new Set();
  let afterIgnores = 0;
  for (const rel of onDisk) {
    if (ignores.some((glob) => path.matchesGlob(rel, glob))) continue;
    afterIgnores++;
    if (gitignored.has(rel)) {
      exclude.push(rel);
      continue;
    }
    scope.push(rel);
    if (!resolvesViaProjectService(path.join(repoRoot, rel), repoRoot, load)) untyped.add(rel);
  }
  const untypedGlobs = compressUntyped(scope, untyped);

  fs.mkdirSync(SCOPE_DIR, { recursive: true });
  fs.writeFileSync(path.join(SCOPE_DIR, `${fixture}.txt`), `${scope.join('\n')}\n`);
  writeJson(path.join(SCOPE_DIR, `${fixture}.json`), { ignores, exclude, untyped: untypedGlobs });
  summary[fixture] = { onDisk: onDisk.length, afterIgnores, files: scope.length, typed: scope.length - untyped.size, untyped: untyped.size, untypedGlobs: untypedGlobs.length };
  console.log(
    `${fixture.padEnd(11)} JS/TS on disk ${String(onDisk.length).padStart(5)} -> scope ${String(scope.length).padStart(5)} (typed ${String(scope.length - untyped.size).padStart(5)}, untyped ${String(untyped.size).padStart(5)} in ${untypedGlobs.length} globs)`,
  );
}
writeJson(path.join(SCOPE_DIR, 'summary.json'), summary);
