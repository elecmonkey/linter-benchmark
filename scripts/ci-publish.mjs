// Runs only in the workflow's publishing job, after explicit dispatch approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { PUBLICATION, GENERATED_PATHS, isGeneratedPath, assertPullRequest } from './ci-contract.mjs';
import { ROOT, readJson } from './lib.mjs';
import { validateDirectory } from './ci-results.mjs';

const command = (bin, args) => execFileSync(bin, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 ** 2 }).trim();
const git = (...args) => command('git', args);
const api = (endpoint, args = []) => JSON.parse(command('gh', ['api', ...args, endpoint]));
const fail = (message) => { throw new Error(message); };
const artifact = path.join(ROOT, '.benchmark-output');
const environment = readJson(path.join(artifact, 'results/environment.json'));

if (process.env.GITHUB_REPOSITORY !== PUBLICATION.repository || process.env.GITHUB_REF !== `refs/heads/${PUBLICATION.base}`) fail('publication is allowed only from this repository main branch');
if (process.env.BENCHMARK_PUBLISH_APPROVED !== 'true') fail('workflow dispatch did not approve publication');
if (environment.sourceCommit !== process.env.GITHUB_SHA) fail('artifact source differs from the dispatched commit');
if (environment.ciRunId !== `${process.env.GITHUB_RUN_ID}/${process.env.GITHUB_RUN_ATTEMPT}`) fail('artifact belongs to another workflow run');
const remote = git('remote', 'get-url', '--push', 'origin').replace(/\.git$/, '');
if (remote !== `https://github.com/${PUBLICATION.repository}`) fail('origin differs from the publication target');
validateDirectory(artifact);

function inspectFiles(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.posix.join(rel, entry.name);
    const absolute = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) fail(`artifact contains a symbolic link: ${file}`);
    if (entry.isDirectory()) inspectFiles(absolute, file);
    else if (!isGeneratedPath(file)) fail(`artifact contains an unapproved path: ${file}`);
  }
}
inspectFiles(artifact);
for (const file of GENERATED_PATHS) if (!fs.existsSync(path.join(artifact, file))) fail(`missing generated path: ${file}`);

git('fetch', '--no-tags', 'origin', PUBLICATION.base);
if (git('rev-parse', 'FETCH_HEAD') !== environment.sourceCommit) fail('main changed while benchmarking; dispatch a new run instead of publishing stale data');
const pulls = api(`repos/${PUBLICATION.repository}/pulls?state=open&base=${PUBLICATION.base}&head=${encodeURIComponent(PUBLICATION.repository.split('/')[0] + ':' + PUBLICATION.branch)}`);
if (pulls.length > 1) fail('multiple PRs match the automation branch');
if (pulls.length) assertPullRequest(pulls[0]);

git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
const existing = git('ls-remote', '--heads', 'origin', `refs/heads/${PUBLICATION.branch}`);
if (existing) {
  git('fetch', '--no-tags', 'origin', PUBLICATION.branch);
  const previous = git('rev-parse', 'FETCH_HEAD');
  if (git('show', '-s', '--format=%ae', previous) !== '41898282+github-actions[bot]@users.noreply.github.com' || git('show', '-s', '--format=%B', previous) !== PUBLICATION.commitMessage.trim()) fail('automation branch was edited outside this workflow');
  git('switch', '-c', PUBLICATION.branch, previous);
  const merge = spawnSync('git', ['merge', '--no-commit', '--no-ff', environment.sourceCommit], { cwd: ROOT, encoding: 'utf8' });
  if (merge.status !== 0) {
    const conflicts = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
    if (!conflicts.length || conflicts.some((file) => !isGeneratedPath(file))) fail('main conflicts with non-generated automation branch files');
  }
} else git('switch', '-c', PUBLICATION.branch, environment.sourceCommit);

for (const file of GENERATED_PATHS) {
  const target = path.join(ROOT, file);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(artifact, file), target, { recursive: true });
}
git('add', '--', ...GENERATED_PATHS);
const changed = git('diff', '--name-only', environment.sourceCommit).split('\n').filter(Boolean);
if (changed.some((file) => !isGeneratedPath(file))) fail('publication would modify source files outside the generated paths');
if (!changed.length) {
  console.log('No benchmark changes to publish');
  process.exit(0);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-publication-'));
try {
  const messageFile = path.join(temp, 'commit.txt');
  fs.writeFileSync(messageFile, PUBLICATION.commitMessage);
  git('commit', '--file', messageFile);
  const sha = git('rev-parse', 'HEAD');
  const commitBody = execFileSync('git', ['cat-file', 'commit', sha], { cwd: ROOT }).toString().split('\n\n').slice(1).join('\n\n');
  if (commitBody !== PUBLICATION.commitMessage) fail('actual commit message differs from the approved bytes');
  if (git('ls-remote', 'origin', `refs/heads/${PUBLICATION.base}`).split(/\s+/)[0] !== environment.sourceCommit) fail('main changed before publication; dispatch a new run');
  git('push', 'origin', `HEAD:refs/heads/${PUBLICATION.branch}`);
  if (git('ls-remote', 'origin', `refs/heads/${PUBLICATION.branch}`).split(/\s+/)[0] !== sha) fail('pushed branch differs from the expected commit');
  git('fetch', '--no-tags', 'origin', PUBLICATION.branch);
  const remoteBody = execFileSync('git', ['cat-file', 'commit', 'FETCH_HEAD'], { cwd: ROOT }).toString().split('\n\n').slice(1).join('\n\n');
  if (git('rev-parse', 'FETCH_HEAD') !== sha || remoteBody !== PUBLICATION.commitMessage) fail('remote commit message differs; publication stopped');

  let pr = pulls[0];
  if (!pr) {
    const payloadFile = path.join(temp, 'pr.json');
    const payload = { title: PUBLICATION.title, body: PUBLICATION.body, base: PUBLICATION.base, head: PUBLICATION.branch, draft: false };
    fs.writeFileSync(payloadFile, JSON.stringify(payload));
    const bytes = readJson(payloadFile);
    if (bytes.title !== PUBLICATION.title || bytes.body !== PUBLICATION.body || bytes.base !== PUBLICATION.base || bytes.head !== PUBLICATION.branch) fail('PR payload differs from the approved text or target');
    pr = api(`repos/${PUBLICATION.repository}/pulls`, ['--method', 'POST', '--input', payloadFile]);
  }
  let published;
  for (let attempt = 0; attempt < 5; attempt++) {
    published = api(`repos/${PUBLICATION.repository}/pulls/${pr.number}`);
    assertPullRequest(published);
    if (published.head.sha === sha) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (published.head.sha !== sha) fail('PR head differs from the pushed commit');
  console.log(published.html_url);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\nBenchmark update PR: ${published.html_url}\n`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
