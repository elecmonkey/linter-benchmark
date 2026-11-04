// Step 2: map every universe rule onto each tool and derive the A/B rule sets.
//
// How support is determined (no hand-maintained lists):
//   * Rslint - enable the rule alone via `--rule` and check that Rslint reports
//              "1 rule" (unknown rules are dropped, giving "0 rules").
//   * Oxlint - `oxlint --rules -f json`. typescript-eslint extension rules
//              (no-unused-vars, no-unused-expressions, ...) live under Oxlint's
//              `eslint/` scope and cover TypeScript as well.
//   * Biome  - `biome migrate eslint --include-nursery` on a one-rule ESLint
//              config. Only Biome rules whose source is "same as" the ESLint
//              rule count. "Inspired by" mappings are recorded for reference
//              but NOT used, since their semantics differ.
//
// Group A = universe rules supported by Rslint AND Oxlint  (ESLint, Rslint, Oxlint)
// Group B = group A rules that Biome also supports ("same") (all four tools)
//
// Output: rules/oxlint-rules.json, rules/matrix.json, rules/groups.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BIN, RULES_DIR, TS_PREFIX, readJson, run, writeJson } from './lib.mjs';

const universe = readJson(path.join(RULES_DIR, 'universe.json'));

// ------------------------------------------------------------------ Oxlint
const oxlintRules = JSON.parse(run(path.join(BIN, 'oxlint'), ['--rules', '-f', 'json']).stdout);
writeJson(path.join(RULES_DIR, 'oxlint-rules.json'), oxlintRules);
const oxlintIndex = new Set(oxlintRules.map((r) => `${r.scope}/${r.value}`));

function oxlintName(rule) {
  const short = rule.replace(TS_PREFIX, '');
  const candidates = rule.startsWith(TS_PREFIX) ? [`typescript/${short}`, `eslint/${short}`] : [`eslint/${short}`];
  return candidates.find((name) => oxlintIndex.has(name)) ?? null;
}

// ------------------------------------------------------------------ Rslint
const rslintProbe = fs.mkdtempSync(path.join(os.tmpdir(), 'rslint-probe-'));
// Type-aware rules are only counted when a TypeScript project is available.
fs.writeFileSync(path.join(rslintProbe, 'a.ts'), 'export {};\n');
fs.writeFileSync(path.join(rslintProbe, 'tsconfig.json'), '{ "include": ["*.ts"] }\n');
fs.writeFileSync(
  path.join(rslintProbe, 'rslint.config.mjs'),
  "export default [{ files: ['**/*.ts'], plugins: ['@typescript-eslint'], languageOptions: { parserOptions: { projectService: true } }, rules: {} }];\n",
);

function rslintSupports(rule) {
  const { stdout, stderr } = run(path.join(BIN, 'rslint'), ['--no-color', '--rule', `${rule}: error`], { cwd: rslintProbe });
  const match = /(\d+) rules?\b/.exec(stdout + stderr);
  if (!match) throw new Error(`cannot parse rslint output for ${rule}:\n${stdout}${stderr}`);
  return Number(match[1]) === 1;
}

// ------------------------------------------------------------------ Biome
function biomeMigrate(rule, { inspired }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biome-migrate-'));
  try {
    fs.writeFileSync(path.join(dir, '.eslintrc.json'), JSON.stringify({ plugins: ['@typescript-eslint'], rules: { [rule]: 'error' } }));
    fs.writeFileSync(path.join(dir, 'biome.json'), '{}');
    const flags = ['--include-nursery', ...(inspired ? ['--include-inspired'] : [])];
    run(path.join(BIN, 'biome'), ['migrate', 'eslint', '--write', ...flags], { cwd: dir });
    const groups = readJson(path.join(dir, 'biome.json')).linter?.rules ?? {};
    return Object.entries(groups)
      .filter(([, rules]) => typeof rules === 'object')
      .flatMap(([group, rules]) => Object.keys(rules).map((name) => `${group}/${name}`))
      .sort();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Biome's metadata names the source of nursery/useAwaitThenable as
// "@typescript-eslint/use-await-thenable", so `migrate` cannot find it. Its
// docs list it as *inspired by* await-thenable; recorded for reference only.
const BIOME_INSPIRED_EXTRA = { '@typescript-eslint/await-thenable': ['nursery/useAwaitThenable'] };

// ------------------------------------------------------------------ matrix
const matrix = universe.map(({ rule, typed }) => {
  const same = biomeMigrate(rule, { inspired: false });
  const inspired = [...biomeMigrate(rule, { inspired: true }), ...(BIOME_INSPIRED_EXTRA[rule] ?? [])].filter(
    (name, i, all) => !same.includes(name) && all.indexOf(name) === i,
  );
  return {
    rule,
    typed,
    rslint: rslintSupports(rule) ? rule : null,
    oxlint: oxlintName(rule),
    biome: same,
    biomeInspired: inspired,
  };
});
fs.rmSync(rslintProbe, { recursive: true, force: true });
writeJson(path.join(RULES_DIR, 'matrix.json'), matrix);

// ------------------------------------------------------------------ groups
const groupA = matrix.filter((r) => r.rslint && r.oxlint);
const groupB = groupA.filter((r) => r.biome.length > 0);

// Guard: every group B ESLint rule maps to exactly one Biome rule. Several
// ESLint rules may share one Biome rule (no-empty + no-empty-static-block ->
// suspicious/noEmptyBlockStatements); the Biome config enables it once.
if (groupB.some((r) => r.biome.length !== 1)) {
  throw new Error('group B: an ESLint rule maps onto several Biome rules');
}

const describe = (rules, tools) => ({
  tools,
  syntactic: rules.filter((r) => !r.typed).length,
  typeAware: rules.filter((r) => r.typed).length,
  rules: rules.map((r) => ({ typed: r.typed, eslint: r.rule, rslint: r.rslint, oxlint: r.oxlint, biome: r.biome[0] ?? null })),
});

const groups = {
  A: describe(groupA, ['eslint', 'rslint', 'oxlint']),
  B: describe(groupB, ['eslint', 'rslint', 'oxlint', 'biome']),
};
writeJson(path.join(RULES_DIR, 'groups.json'), groups);

for (const [name, g] of Object.entries(groups)) {
  console.log(`group ${name}: ${g.syntactic} syntactic + ${g.typeAware} type-aware rules; tools: ${g.tools.join(', ')}`);
}
