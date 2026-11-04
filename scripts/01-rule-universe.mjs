// Step 1: compute the rule universe.
//
// Universe = the rules that are effectively ON for a `.ts` file under
//   js.configs.recommended + typescript-eslint `recommendedTypeChecked`
// (the latter also turns off core rules that TypeScript makes redundant,
// e.g. no-undef, and swaps in the @typescript-eslint/ extension rules).
//
// Output: rules/universe.json  [{ rule, typed }]
import path from 'node:path';
import js from '@eslint/js';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { RULES_DIR, TS_PREFIX, writeJson } from './lib.mjs';

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
});
const config = await eslint.calculateConfigForFile('example.ts');

const severity = (value) => (Array.isArray(value) ? value[0] : value);
const isOn = (value) => severity(value) !== 0 && severity(value) !== 'off';
const requiresTypes = (rule) =>
  rule.startsWith(TS_PREFIX) &&
  Boolean(tseslint.plugin.rules[rule.slice(TS_PREFIX.length)].meta.docs?.requiresTypeChecking);

const universe = Object.entries(config.rules)
  .filter(([, value]) => isOn(value))
  .map(([rule]) => ({ rule, typed: requiresTypes(rule) }));

writeJson(path.join(RULES_DIR, 'universe.json'), universe);
console.log(`${universe.length} rules (${universe.filter((r) => r.typed).length} type-aware)`);
