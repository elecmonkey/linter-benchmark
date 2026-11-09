// Step 1: validate the pinned rule baseline and write its universe.
// Keeping the catalog explicit preserves comparisons across tool refactors.
import path from 'node:path';
import { RULES_DIR, readJson, writeJson } from './lib.mjs';

const { rules } = readJson(path.join(RULES_DIR, 'catalog.json'));
const names = new Set();
for (const entry of rules) {
  if (typeof entry.rule !== 'string' || typeof entry.typed !== 'boolean' || !Array.isArray(entry.biome)) {
    throw new Error(`invalid catalog entry: ${JSON.stringify(entry)}`);
  }
  if (names.has(entry.rule)) throw new Error(`duplicate baseline rule: ${entry.rule}`);
  if (entry.biome.length > 1) throw new Error(`ambiguous Biome mapping: ${entry.rule}`);
  names.add(entry.rule);
}
writeJson(path.join(RULES_DIR, 'universe.json'), rules.map(({ rule, typed }) => ({ rule, typed })));
console.log(`${rules.length} baseline rules (${rules.filter((r) => r.typed).length} type-aware)`);
