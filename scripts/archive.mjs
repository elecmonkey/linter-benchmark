import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const ARCHIVE_DIR = 'archives';
export const ARCHIVE_INDEX = `${ARCHIVE_DIR}/README.md`;
const SNAPSHOT_PATHS = ['README.md', 'AGENTS.md', 'results', 'scope', 'configs', 'rules', 'package.json', 'pnpm-lock.yaml', 'fixture/manifest.json'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const encodePath = (file) => file.split('/').map((part) => encodeURIComponent(part).replace(/[()']/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');

function readCommitFiles(root, commit, paths) {
  const output = execFileSync('git', ['ls-tree', '-r', '-z', commit, '--', ...paths], { cwd: root }).toString();
  const entries = output.split('\0').filter(Boolean).map((line) => {
    const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(line);
    if (!match || match[2] !== 'blob' || !['100644', '100755'].includes(match[1])) throw new Error(`unsupported archive entry: ${line}`);
    return { mode: match[1], blob: match[3], file: match[4] };
  });
  if (!entries.length) return [];
  const blobs = [...new Set(entries.map((entry) => entry.blob))];
  const data = execFileSync('git', ['cat-file', '--batch'], { cwd: root, input: blobs.join('\n') + '\n', maxBuffer: 128 * 1024 ** 2 });
  const contents = new Map();
  let offset = 0;
  for (const blob of blobs) {
    const end = data.indexOf(10, offset);
    const [actual, type, size] = data.subarray(offset, end).toString().split(' ');
    if (actual !== blob || type !== 'blob') throw new Error('unexpected archive blob response');
    const length = Number(size);
    offset = end + 1;
    contents.set(blob, data.subarray(offset, offset + length));
    offset += length + 1;
  }
  return entries.map((entry) => ({ ...entry, bytes: contents.get(entry.blob) }));
}

export function rewriteArchiveUrl(url, { document, archivedFiles, sourceDirectories = new Set(), repository, commit, image = false }) {
  if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return url;
  const suffixAt = url.search(/[?#]/);
  const pathname = suffixAt < 0 ? url : url.slice(0, suffixAt);
  const suffix = suffixAt < 0 ? '' : url.slice(suffixAt);
  let decoded;
  try { decoded = decodeURIComponent(pathname.replace(/\\([\\ ()])/g, '$1')); }
  catch { throw new Error(`invalid archive URL: ${url}`); }
  const target = path.posix.normalize(decoded.startsWith('/') ? decoded.slice(1) : path.posix.join(path.posix.dirname(document), decoded));
  if (target === '..' || target.startsWith('../')) throw new Error(`archive link escapes the repository: ${url}`);
  const isDirectory = target === '.' || [...archivedFiles].some((file) => file.startsWith(`${target}/`));
  if (archivedFiles.has(target) || isDirectory) {
    return encodePath(path.posix.relative(path.posix.dirname(document), target) || '.') + suffix;
  }
  // A source-code or earlier-history link must refer to its original revision,
  // rather than silently resolving against newer live repository files.
  if (image) return `https://raw.githubusercontent.com/${repository}/${commit}/${encodePath(target)}${suffix}`;
  return `https://github.com/${repository}/${sourceDirectories.has(target) ? 'tree' : 'blob'}/${commit}/${encodePath(target)}${suffix}`;
}

function rewriteLine(line, options) {
  const replacements = [];
  const code = [...line.matchAll(/(`+)[\s\S]*?\1/g)].map((match) => [match.index, match.index + match[0].length]);
  const inCode = (offset) => code.some(([start, end]) => offset >= start && offset < end);
  const add = (start, end, image = false) => {
    if (inCode(start)) return;
    const old = line.slice(start, end);
    const url = rewriteArchiveUrl(old, { ...options, image });
    if (url !== old) replacements.push({ start, end, url });
  };
  for (const match of line.matchAll(/!?\[[^\]\n]*\]\(/g)) {
    if (inCode(match.index)) continue;
    let start = match.index + match[0].length;
    while (/\s/.test(line[start] ?? '') && start < line.length) start++;
    if (line[start] === '<') {
      const end = line.indexOf('>', start + 1);
      if (end >= 0) add(start + 1, end, match[0].startsWith('!'));
    } else {
      let end = start, depth = 0;
      while (end < line.length) {
        const c = line[end];
        if (c === '\\') { end += 2; continue; }
        if (c === '(') depth++;
        else if (c === ')') { if (!depth) break; depth--; }
        else if (/\s/.test(c) && !depth) break;
        end++;
      }
      add(start, end, match[0].startsWith('!'));
    }
  }
  const reference = /^ {0,3}\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/.exec(line);
  if (reference) {
    const url = reference[1] ?? reference[2];
    const start = line.indexOf(url, line.indexOf(':') + 1);
    add(start, start + url.length);
  }
  for (const match of line.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) {
    const start = match.index + match[0].indexOf(match[1]) + 1;
    add(start, start + match[2].length, /^src/i.test(match[0]));
  }
  let result = line;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, replacement.start) + replacement.url + result.slice(replacement.end);
  }
  return result;
}

export function rewriteArchiveMarkdown(text, options) {
  let fence;
  return text.split('\n').map((line) => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      return line;
    }
    return fence ? line : rewriteLine(line, options);
  }).join('\n');
}

export function assertArchivesPreserved(root, commit) {
  for (const entry of readCommitFiles(root, commit, [ARCHIVE_DIR])) {
    if (entry.file === ARCHIVE_INDEX) continue;
    const file = path.join(root, entry.file);
    if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink() || !fs.readFileSync(file).equals(entry.bytes)) {
      throw new Error(`existing archive would be changed or deleted: ${entry.file}`);
    }
  }
}

export function archivePreviousResults({ root, commit, repository }) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('archive requires a full source commit SHA');
  assertArchivesPreserved(root, commit);
  const archiveRoot = path.join(root, ARCHIVE_DIR);
  if (fs.existsSync(archiveRoot) && fs.lstatSync(archiveRoot).isSymbolicLink()) throw new Error('archive root cannot be a symbolic link');
  const entries = readCommitFiles(root, commit, SNAPSHOT_PATHS);
  if (!entries.some((entry) => entry.file === 'README.md') || !entries.some((entry) => entry.file.startsWith('results/raw/'))) throw new Error('previous revision has no benchmark snapshot to archive');
  const archivedFiles = new Set(entries.map((entry) => entry.file));
  const sourceDirectories = new Set(execFileSync('git', ['ls-tree', '-r', '-d', '--name-only', '-z', commit], { cwd: root }).toString().split('\0').filter(Boolean));
  const date = execFileSync('git', ['show', '-s', '--format=%cI', commit], { cwd: root, encoding: 'utf8' }).trim();
  const archivePath = `${ARCHIVE_DIR}/${commit}`;
  const directory = path.join(root, archivePath);
  const files = entries.map((entry) => {
    let bytes = entry.bytes;
    if (entry.file.endsWith('.md')) {
      let text = rewriteArchiveMarkdown(bytes.toString(), { document: entry.file, archivedFiles, sourceDirectories, repository, commit });
      if (entry.file === 'README.md') text = `> Archived benchmark snapshot from [${commit.slice(0, 12)}](https://github.com/${repository}/tree/${commit}). Reproduce with the source at that revision.\n\n` + text;
      bytes = Buffer.from(text);
    }
    return { ...entry, bytes, sha256: sha256(bytes) };
  });
  const metadata = Buffer.from(JSON.stringify({ sourceCommit: commit, sourceDate: date, files: files.map(({ file, blob, sha256 }) => ({ file, blob, sha256 })) }, null, 2) + '\n');
  const expected = [...files, { file: 'metadata.json', bytes: metadata, mode: '100644' }];
  if (fs.existsSync(directory)) {
    if (fs.lstatSync(directory).isSymbolicLink() || fs.readdirSync(directory, { recursive: true, withFileTypes: true }).some((entry) => entry.isSymbolicLink())) throw new Error(`archive contains a symbolic link: ${archivePath}`);
    const actual = fs.readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name))).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected.map((entry) => entry.file).sort())) throw new Error(`archive contents differ: ${archivePath}`);
    for (const entry of expected) {
      const file = path.join(directory, entry.file);
      if (fs.lstatSync(file).isSymbolicLink() || !fs.readFileSync(file).equals(entry.bytes)) throw new Error(`refusing to overwrite archive: ${file}`);
    }
  } else {
    for (const entry of expected) {
      const file = path.join(directory, entry.file);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, entry.bytes, { mode: entry.mode === '100755' ? 0o755 : 0o644 });
    }
  }
  const snapshots = fs.readdirSync(path.join(root, ARCHIVE_DIR), { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^[a-f0-9]{40}$/.test(entry.name)).map((entry) => {
    const data = JSON.parse(fs.readFileSync(path.join(root, ARCHIVE_DIR, entry.name, 'metadata.json')));
    if (data.sourceCommit !== entry.name) throw new Error('archive directory and metadata disagree');
    return data;
  }).sort((a, b) => b.sourceDate.localeCompare(a.sourceDate) || a.sourceCommit.localeCompare(b.sourceCommit));
  const index = '# Archived benchmark results\n\nEach snapshot preserves the previous main revision before a CI results update.\n\n| Source date | Source commit | Snapshot |\n|---|---|---|\n' + snapshots.map((snapshot) => `| ${snapshot.sourceDate} | \`${snapshot.sourceCommit.slice(0, 12)}\` | [README](${snapshot.sourceCommit}/README.md) · [Report](${snapshot.sourceCommit}/results/report.md) |`).join('\n') + '\n';
  fs.writeFileSync(path.join(root, ARCHIVE_INDEX), index);
  return { archivePath, indexPath: ARCHIVE_INDEX };
}
