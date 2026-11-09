import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CONFIGS_DIR, FIXTURES, ROOT, RULES_DIR, readJson, ruleTool, toolName, toolsForGroup } from './lib.mjs';

const groups = readJson(path.join(RULES_DIR, 'groups.json'));
const typedTools = ['rslint', 'oxlint-tsgolint', 'oxlint-tsrs', 'oxlint-tsrs-fast'];

test('the requested comparator groups are explicit and preserve the rule baseline', () => {
  assert.deepEqual(groups.A.tools, typedTools);
  assert.deepEqual(groups.B.tools, [...typedTools, 'biome']);
  assert.deepEqual(groups.C.tools, ['rslint', 'oxlint', 'biome']);
  assert.deepEqual(Object.values(groups).map((g) => [g.syntactic, g.typeAware]), [[68, 23], [57, 9], [56, 0]]);
  assert.equal(groups.C.typeInfo, false);
  assert(!groups.C.rules.some((r) => r.rule === '@typescript-eslint/no-unused-vars'));
  for (const group of Object.values(groups)) {
    for (const rule of group.rules) assert(!Object.hasOwn(rule, 'eslint'));
  }
  const subset = { ...groups.A, tools: ['rslint', 'oxlint-tsgolint'] };
  assert.deepEqual(toolsForGroup(subset), subset.tools);
  assert.deepEqual(toolsForGroup(groups.C, ['rslint', 'oxlint-tsrs']), ['rslint']);
});

test('all engine variants map to native Oxlint rules and exact display labels', () => {
  for (const tool of typedTools.slice(1)) assert.equal(ruleTool(tool), 'oxlint');
  assert.equal(toolName('oxlint'), 'Oxlint');
  assert.equal(toolName('oxlint-tsgolint'), 'Oxlint (tsgolint)');
  assert.equal(toolName('oxlint-tsrs'), 'Oxlint (tsrs)');
  assert.equal(toolName('oxlint-tsrs-fast'), 'Oxlint (tsrs --fast)');
  assert.throws(() => toolsForGroup(groups.A, ['eslint']), /unknown benchmark tool/);
  assert.throws(() => toolsForGroup({ ...groups.C, tools: ['oxlint-tsrs'] }), /without type information/);
});

test('generated configurations use only the native tools and group rule sets', async () => {
  for (const [group, def] of Object.entries(groups)) {
    for (const fixture of FIXTURES) {
      const dir = path.join(CONFIGS_DIR, `group-${group.toLowerCase()}`, fixture);
      const files = ['oxlintrc.json', 'rslint.config.mjs', ...(group === 'A' ? [] : ['biome.json'])].sort();
      assert.deepEqual(fs.readdirSync(dir).sort(), files);
      const config = (await import(pathToFileURL(path.join(dir, 'rslint.config.mjs')))).default;
      assert.deepEqual(new Set(Object.keys(config[1].rules)), new Set(def.rules.map((r) => r.rslint)));
      assert.equal(config[1].languageOptions.parserOptions.projectService, def.typeInfo);
      const oxlint = readJson(path.join(dir, 'oxlintrc.json'));
      assert.deepEqual(new Set(Object.keys(oxlint.rules)), new Set(def.rules.map((r) => r.oxlint)));
      if (!def.typeInfo) assert.equal(oxlint.overrides.length, 0);
      if (group !== 'A') {
        const biome = readJson(path.join(dir, 'biome.json'));
        const enabled = Object.entries(biome.linter.rules).filter(([, value]) => typeof value === 'object')
          .flatMap(([category, rules]) => Object.keys(rules).map((rule) => `${category}/${rule}`));
        assert.deepEqual(new Set(enabled), new Set(def.rules.map((r) => r.biome)));
      }
    }
  }
});

test('retired dependencies and CLI options cannot enter the benchmark', () => {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  for (const name of ['eslint', '@eslint/js', 'typescript-eslint', '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin']) {
    assert(!Object.hasOwn(pkg.dependencies, name));
  }
  for (const args of [
    ['--groups', 'A', '--tools', 'eslint'],
    ['--eslint-heap-mb', '32768'],
    ['--groups', 'C', '--tools', 'oxlint-tsgolint'],
  ]) {
    const result = spawnSync(process.execPath, ['scripts/05-run.mjs', ...args], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown benchmark|no selected tools/);
  }
});

test('directory alias exclusions cannot hide canonical Biome files', () => {
  const scope = readJson(path.join(ROOT, 'scope', 'rstest.json'));
  assert(scope.directoryAliases.includes('.claude/skills/**'));
  for (const group of ['a', 'b', 'c']) {
    const dir = path.join(CONFIGS_DIR, `group-${group}`, 'rstest');
    assert(readJson(path.join(dir, 'oxlintrc.json')).ignorePatterns.includes('.claude/skills/**'));
    if (group !== 'a') {
      assert(!readJson(path.join(dir, 'biome.json')).files.includes.includes('!.claude/skills/**'));
    }
  }
});
