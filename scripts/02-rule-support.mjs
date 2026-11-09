// Step 2: verify native rule support and derive the explicit A/B/C groups.
// Rslint is probed with and without a project; Oxlint supplies its rule list.
// Equivalent Biome mappings are pinned in catalog.json and validated natively.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BIN, RULES_DIR, TS_PREFIX, readJson, run, writeJson } from './lib.mjs';

const universe = readJson(path.join(RULES_DIR, 'universe.json'));
const catalog = readJson(path.join(RULES_DIR, 'catalog.json'));
const catalogIndex = new Map(catalog.rules.map((r) => [r.rule, r]));
const biomeVersion = readJson(path.join(BIN, '..', '@biomejs', 'biome', 'package.json')).version;
if (biomeVersion !== catalog.biomeVersion) {
  throw new Error(`Biome ${biomeVersion} differs from catalog ${catalog.biomeVersion}; review the equivalent mappings before updating the version`);
}

const oxlintResult = run(path.join(BIN, 'oxlint'), ['--rules', '-f', 'json']);
if (oxlintResult.status !== 0) throw new Error(oxlintResult.stderr);
const oxlintRules = JSON.parse(oxlintResult.stdout);
writeJson(path.join(RULES_DIR, 'oxlint-rules.json'), oxlintRules);
const oxlintIndex = new Set(oxlintRules.map((r) => `${r.scope}/${r.value}`));
function oxlintName(rule) {
  const short = rule.replace(TS_PREFIX, '');
  const candidates = rule.startsWith(TS_PREFIX) ? [`typescript/${short}`, `eslint/${short}`] : [`eslint/${short}`];
  return candidates.find((name) => oxlintIndex.has(name)) ?? null;
}

const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-rules-'));
let matrix;
try {
  const dirs = [true, false].map((typed) => {
    const dir = path.join(probe, typed ? 'typed' : 'untyped');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'a.ts'), 'export {};\n');
    if (typed) fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{"include":["*.ts"]}\n');
    fs.writeFileSync(path.join(dir, 'rslint.config.mjs'),
      `export default [{ files: ['**/*.ts'], plugins: ['@typescript-eslint'], languageOptions: { parserOptions: { projectService: ${typed} } }, rules: {} }];\n`);
    return dir;
  });
  function rslintSupports(rule, cwd) {
    const { stdout, stderr } = run(path.join(BIN, 'rslint'), ['--no-color', '--rule', `${rule}: error`], { cwd });
    const match = /(\d+) rules?\b/.exec(stdout + stderr);
    if (!match) throw new Error(`cannot parse Rslint support for ${rule}:\n${stdout}${stderr}`);
    return Number(match[1]) === 1;
  }
  matrix = universe.map(({ rule, typed }) => {
    const entry = catalogIndex.get(rule);
    if (!entry || entry.typed !== typed) throw new Error(`catalog/universe mismatch: ${rule}`);
    return {
      rule, typed,
      rslint: rslintSupports(rule, dirs[0]) ? rule : null,
      rslintWithoutTypes: rslintSupports(rule, dirs[1]),
      oxlint: oxlintName(rule),
      biome: entry.biome,
    };
  });

  const rules = {};
  for (const name of new Set(matrix.flatMap((r) => r.biome))) {
    const [category, rule] = name.split('/');
    (rules[category] ??= {})[rule] = 'error';
  }
  const dir = path.join(probe, 'biome');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'a.ts'), 'export {};\n');
  writeJson(path.join(dir, 'biome.json'), { linter: { enabled: true, rules: { preset: 'none', ...rules } } });
  const result = run(path.join(BIN, 'biome'), ['lint', 'a.ts'], { cwd: dir });
  if (result.status !== 0) throw new Error(`Biome mapping validation failed:\n${result.stdout}${result.stderr}`);
} finally {
  fs.rmSync(probe, { recursive: true, force: true });
}
writeJson(path.join(RULES_DIR, 'matrix.json'), matrix);

const groupA = matrix.filter((r) => r.rslint && r.oxlint);
const groupB = groupA.filter((r) => r.biome.length === 1);
const groupC = groupB.filter((r) => !r.typed && r.rslintWithoutTypes);
const describe = (rules, tools, typeInfo = true) => ({
  tools, typeInfo,
  syntactic: rules.filter((r) => !r.typed).length,
  typeAware: rules.filter((r) => r.typed).length,
  rules: rules.map((r) => ({ rule: r.rule, typed: r.typed, rslint: r.rslint, oxlint: r.oxlint, biome: r.biome[0] ?? null })),
});
const typedTools = ['rslint', 'oxlint-tsgolint', 'oxlint-tsrs', 'oxlint-tsrs-fast'];
const groups = {
  A: describe(groupA, typedTools),
  B: describe(groupB, [...typedTools, 'biome']),
  C: describe(groupC, ['rslint', 'oxlint', 'biome'], false),
};
writeJson(path.join(RULES_DIR, 'groups.json'), groups);
for (const [name, group] of Object.entries(groups)) {
  console.log(`group ${name}: ${group.syntactic} syntactic + ${group.typeAware} type-aware rules; tools: ${group.tools.join(', ')}`);
}
