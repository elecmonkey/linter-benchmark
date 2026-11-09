// Publication contract shown before a maintainer dispatches the workflow.
export const PUBLICATION = Object.freeze({
  repository: 'elecmonkey/linter-benchmark',
  base: 'main',
  branch: 'ci/benchmark-results',
  title: 'Update benchmark results',
  body: 'Refresh all A/B/C benchmark results, charts, scope, configurations, and README using the pinned fixture revisions and tool versions.\n\nEach combination uses one warmup and five measured runs.\n',
  commitMessage: 'Update benchmark results\n',
});

export const GENERATED_PATHS = Object.freeze([
  'README.md', 'results', 'scope', 'configs', 'fixture/manifest.json',
  'rules/universe.json', 'rules/matrix.json', 'rules/groups.json', 'rules/oxlint-rules.json',
]);

export function isGeneratedPath(file) {
  if (file.split('/').some((part) => part === '..' || part === '.git')) return false;
  return GENERATED_PATHS.some((root) => file === root || ['results', 'scope', 'configs'].includes(root) && file.startsWith(`${root}/`));
}

export function assertPullRequest(pr) {
  if (pr.title !== PUBLICATION.title || pr.body !== PUBLICATION.body ||
      pr.base.ref !== PUBLICATION.base || pr.head.ref !== PUBLICATION.branch ||
      pr.base.repo.full_name !== PUBLICATION.repository || pr.head.repo.full_name !== PUBLICATION.repository) {
    throw new Error('PR target or text differs from the publication contract; no further writes are allowed');
  }
}
