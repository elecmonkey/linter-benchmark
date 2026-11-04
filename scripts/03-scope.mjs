// Step 3: fix the exact set of files every tool lints, per fixture.
//
// The scope follows each repository's own lint setup (its rstack.config.*):
// we lint what the repository itself lints WITH type information.
//
//   1. git-tracked .ts/.tsx/.mts/.cts files, excluding .d.ts
//      (tracked files are by definition not gitignored);
//   2. included by one of the repository's configured `parserOptions.project`
//      tsconfigs (rsbuild uses projectService, so: any tsconfig.json);
//   3. not matched by the repository's `ignores` / `globalIgnores`, nor by
//      globs where it explicitly disables type information;
//   4. resolvable by projectService (nearest tsconfig.json walking up, or a
//      project it references) - all tools run with projectService-style
//      discovery, so every file must be reachable that way.
//
// The resulting list is passed explicitly on the command line to every tool.
//
// Output: scope/<fixture>.txt, scope/summary.json
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { FIXTURES, FIXTURE_DIR, SCOPE_DIR, run, writeJson } from './lib.mjs';

// Transcribed from each fixture's rstack.config.* `define.lint(...)`.
const REPO_LINT = {
  rsbuild: {
    projects: ['**/tsconfig.json'], // projectService: true
    ignores: [
      'e2e/cases/browser-logs/skip-build-error/src/index.js',
      'e2e/cases/wasm/wasm-source-import/src/index.js',
      // projectService: false ("templates lack installed dependencies ...")
      'packages/create-rsbuild/template-*/**',
      'e2e/cases/**/src/**',
    ],
  },
  rsdoctor: {
    projects: [
      'packages/*/tsconfig.json',
      'packages/*/tests/tsconfig.json',
      'scripts/*/tsconfig.json',
      'examples/*/tsconfig.json',
      'e2e/tsconfig.json',
    ],
    ignores: ['packages/core/tests/build/utils/bundles/**'],
  },
  rslib: {
    projects: [
      'packages/*/tsconfig.json',
      'packages/core/tests/tsconfig.json',
      'examples/*/tsconfig.json',
      'examples/module-federation/*/tsconfig.json',
      'tests/tsconfig.json',
      'tests/scripts/tsconfig.json',
      'tests/type-tests/*/tsconfig.json',
    ],
    ignores: ['tests/integration/wasm/static-source/src/utils.js', 'tests/integration/wasm-inline/basic/src/source.js'],
  },
  rspress: {
    projects: [
      'tsconfig.json',
      'scripts/config/tsconfig.json',
      'packages/*/tsconfig*.json',
      'packages/*/tests/tsconfig.json',
      'website/tsconfig.json',
    ],
    ignores: ['**/*.d.ts'],
  },
  'rstack-cli': {
    projects: [
      'packages/*/tsconfig.json',
      'packages/*/tests/tsconfig.json',
      'packages/rstack/tests/types/*/tsconfig.json',
      'examples/*/tsconfig.json',
      'website/tsconfig.json',
    ],
    ignores: [],
  },
  rstest: {
    projects: ['e2e/tsconfig.json', 'packages/*/tsconfig.json', 'packages/*/tests/tsconfig.json'],
    ignores: [],
  },
};

const SOURCE = /\.(ts|tsx|mts|cts)$/;
const DECLARATION = /\.d\.(ts|mts|cts)$/;

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

const summary = {};
for (const fixture of FIXTURES) {
  const repoRoot = path.join(FIXTURE_DIR, fixture);
  const { projects, ignores } = REPO_LINT[fixture];
  const load = createProjectLoader();

  const tracked = run('git', ['ls-files'], { cwd: repoRoot }).stdout.split('\n');
  const trackedSet = new Set(tracked);
  const candidates = tracked.filter((f) => SOURCE.test(f) && !DECLARATION.test(f));

  // Files covered by the repository's configured projects (tracked tsconfigs only, no node_modules).
  const projectFiles = new Set();
  const projectConfigs = fs
    .globSync(projects, { cwd: repoRoot, exclude: (p) => p.includes('node_modules') })
    .filter((p) => trackedSet.has(p));
  for (const rel of projectConfigs) for (const f of load(path.join(repoRoot, rel)).files) projectFiles.add(f);

  const stages = { tracked: candidates.length, inRepoProjects: 0, afterIgnores: 0, files: 0 };
  const scope = [];
  for (const rel of candidates) {
    const abs = path.join(repoRoot, rel);
    if (!projectFiles.has(abs)) continue;
    stages.inRepoProjects++;
    if (ignores.some((glob) => path.matchesGlob(rel, glob))) continue;
    stages.afterIgnores++;
    if (!resolvesViaProjectService(abs, repoRoot, load)) continue;
    stages.files++;
    scope.push(rel);
  }

  fs.mkdirSync(SCOPE_DIR, { recursive: true });
  fs.writeFileSync(path.join(SCOPE_DIR, `${fixture}.txt`), `${scope.join('\n')}\n`);
  summary[fixture] = { ...stages, repoProjectConfigs: projectConfigs.length };
  console.log(
    `${fixture.padEnd(11)} tracked TS ${String(stages.tracked).padStart(5)} -> in repo projects ${String(stages.inRepoProjects).padStart(5)} -> after ignores ${String(stages.afterIgnores).padStart(5)} -> projectService-resolvable ${String(stages.files).padStart(5)}`,
  );
}
writeJson(path.join(SCOPE_DIR, 'summary.json'), summary);
