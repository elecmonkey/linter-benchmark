import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { archivePreviousResults, rewriteArchiveMarkdown, assertArchivesPreserved } from './archive.mjs';
import { isGeneratedPath, isPublicationPath } from './ci-contract.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-archive-test-'));
  // Only the disposable fixture repository bypasses developer-machine hooks.
  const git = (...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', '-c', 'user.name=Archive Test', '-c', 'user.email=archive-test@example.invalid', ...args], { cwd: root, encoding: 'utf8' }).trim();
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  git('init', '--quiet');
  write('README.md', '# Previous results\n\n![chart](results/charts/old.svg)\n[guide](AGENTS.md)\n[report](results/report.md#results)\n[source](scripts/run.mjs#entry)\n');
  write('AGENTS.md', '# Previous guide\n[README](README.md)\n');
  write('results/charts/old.svg', '<svg>previous chart</svg>');
  write('results/raw/a.json', '{"old":true}\n');
  write('results/report.md', '# Results\n![chart](charts/old.svg)\n[README](../README.md)\n');
  write('scripts/run.mjs', 'console.log("old")\n');
  write('scope/a.txt', 'old.ts\n');
  write('configs/a.json', '{}\n');
  write('rules/catalog.json', '{}\n');
  write('package.json', '{}\n');
  write('pnpm-lock.yaml', 'old: true\n');
  write('fixture/manifest.json', '{}\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'Previous benchmark snapshot');
  return { root, git, write, commit: git('rev-parse', 'HEAD') };
}

test('archive reads the old Git revision and resolves its README/report charts locally', () => {
  const { root, commit, write } = fixture();
  try {
    write('README.md', '# New live results\n');
    write('results/charts/old.svg', '<svg>new chart</svg>');
    write('results/raw/a.json', '{"new":true}\n');
    const result = archivePreviousResults({ root, commit, repository: 'owner/repo' });
    const archive = path.join(root, result.archivePath);
    const readme = fs.readFileSync(path.join(archive, 'README.md'), 'utf8');
    assert(readme.includes('# Previous results'));
    assert(readme.includes('![chart](results/charts/old.svg)'));
    assert(readme.includes('[guide](AGENTS.md)'));
    assert(readme.includes(`https://github.com/owner/repo/blob/${commit}/scripts/run.mjs#entry`));
    assert.equal(fs.readFileSync(path.join(archive, 'results/charts/old.svg'), 'utf8'), '<svg>previous chart</svg>');
    assert.equal(fs.readFileSync(path.join(archive, 'results/raw/a.json'), 'utf8'), '{"old":true}\n');
    const report = fs.readFileSync(path.join(archive, 'results/report.md'), 'utf8');
    assert(report.includes('![chart](charts/old.svg)'));
    assert(report.includes('[README](../README.md)'));
    for (const [document, text] of [['README.md', readme], ['results/report.md', report]]) {
      for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1].split('#')[0];
        if (target.startsWith('https:')) continue;
        assert(fs.existsSync(path.resolve(archive, path.dirname(document), decodeURIComponent(target))), target);
      }
    }
    assert(!fs.existsSync(path.join(archive, 'archives')));
    assert(fs.readFileSync(path.join(root, 'archives/README.md'), 'utf8').includes(`${commit}/README.md`));
    assert.equal(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), '# New live results\n');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Markdown, reference and HTML links preserve suffixes and code examples', () => {
  const commit = 'a'.repeat(40);
  const options = { document: 'README.md', archivedFiles: new Set(['README.md', 'results/charts/old.svg', 'results/a b.md']), sourceDirectories: new Set(['scripts']), repository: 'owner/repo', commit };
  const text = '![old](./results/charts/old.svg?x=1#plot)\n[report](<results/a b.md>)\n[chart]: results/charts/old.svg "Old"\n<img src="/results/charts/old.svg">\n<a href="scripts/run.mjs#entry">source</a>\n[web](https://example.com/x) [anchor](#top)\n`[example](scripts/run.mjs)`\n```md\n[example](scripts/run.mjs)\n```\n';
  const result = rewriteArchiveMarkdown(text, options);
  assert(result.includes('results/charts/old.svg?x=1#plot'));
  assert(result.includes('<results/a%20b.md>'));
  assert(result.includes('[chart]: results/charts/old.svg "Old"'));
  assert(result.includes('src="results/charts/old.svg"'));
  assert(result.includes(`href="https://github.com/owner/repo/blob/${commit}/scripts/run.mjs#entry"`));
  assert(result.includes('[web](https://example.com/x) [anchor](#top)'));
  assert(result.includes('`[example](scripts/run.mjs)`'));
  assert(result.includes('```md\n[example](scripts/run.mjs)\n```'));
  assert.throws(() => rewriteArchiveMarkdown('[escape](../outside)', options), /escapes/);
  assert(rewriteArchiveMarkdown('[source folder](scripts)', options).includes(`/tree/${commit}/scripts`));
  assert.equal(rewriteArchiveMarkdown('[home](.)', options), '[home](.)');
  assert(rewriteArchiveMarkdown('![asset](assets/old.png)', options).includes(`https://raw.githubusercontent.com/owner/repo/${commit}/assets/old.png`));
});

test('repeat publication reuses the immutable snapshot and later snapshots do not recurse', () => {
  const { root, commit, write, git } = fixture();
  try {
    const first = archivePreviousResults({ root, commit, repository: 'owner/repo' });
    const manifest = fs.readFileSync(path.join(root, first.archivePath, 'metadata.json'));
    archivePreviousResults({ root, commit, repository: 'owner/repo' });
    assert(fs.readFileSync(path.join(root, first.archivePath, 'metadata.json')).equals(manifest));
    git('add', '.'); git('commit', '--quiet', '-m', 'Add previous snapshot');
    write('README.md', '# Next results\n'); write('results/raw/a.json', '{"next":true}\n');
    git('add', '.'); git('commit', '--quiet', '-m', 'Next benchmark snapshot');
    const next = git('rev-parse', 'HEAD');
    const second = archivePreviousResults({ root, commit: next, repository: 'owner/repo' });
    assert(!fs.existsSync(path.join(root, second.archivePath, 'archives')));
    assert(fs.readFileSync(path.join(root, first.archivePath, 'metadata.json')).equals(manifest));
    const raw = path.join(root, first.archivePath, 'results/raw/a.json');
    fs.writeFileSync(raw, 'tampered');
    assert.throws(() => assertArchivesPreserved(root, next), /changed or deleted/);
    assert.throws(() => archivePreviousResults({ root, commit, repository: 'owner/repo' }), /overwrite/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('artifacts cannot supply archives, while publication permits only snapshot-shaped archive paths', () => {
  assert(!isGeneratedPath(`archives/${'a'.repeat(40)}/README.md`));
  assert(isPublicationPath(`archives/${'a'.repeat(40)}/README.md`));
  assert(isPublicationPath('archives/README.md'));
  assert(!isPublicationPath('archives/manual/README.md'));
  assert(!isPublicationPath(`archives/${'a'.repeat(40)}/../../scripts/run.mjs`));
});
