# Working on this benchmark

## Layout

```
benchmark/
├── package.json     pinned linter versions + step scripts
├── fixture/         the nine repositories (git submodules)
├── scripts/
│   ├── lib.mjs                  shared paths and helpers
│   ├── 00-setup-fixtures.mjs    submodule checkout + pnpm install --frozen-lockfile --ignore-scripts
│   ├── 01-rule-universe.mjs     pinned rule baseline           -> rules/universe.json
│   ├── 02-rule-support.mjs      per-tool support, groups A/B/C -> rules/
│   ├── 03-scope.mjs             files to lint per fixture      -> scope/
│   ├── 04-configs.mjs           one config per group x tool    -> configs/
│   ├── 05-run.mjs               the benchmark                  -> results/raw/
│   ├── 06-report.mjs            tables                         -> results/report.md + README results section
│   └── 07-chart.mjs             ranking charts                 -> results/charts/
├── rules/
│   ├── catalog.json             pinned baseline + Biome mappings
│   ├── universe.json            baseline rule IDs (92)
│   ├── oxlint-rules.json        Oxlint's rule list
│   ├── matrix.json              per-rule support in each tool
│   └── groups.json              rule sets of groups A, B and C
├── scope/
│   ├── <fixture>.txt            files passed to every tool
│   └── summary.json             file counts per filtering stage
├── configs/
│   ├── group-a/                 rslint.config.mjs, oxlintrc.json
│   ├── group-b/                 the same + biome.json
│   └── group-c/                 the same as group B, no type information
└── results/
    ├── raw/group-<g>/<fixture>/<tool>.json   timings, peak RSS, diagnostics
    ├── charts/group-<g>-<fixture>.svg        ranking charts
    └── report.md                             tables
```

`logs/` (gitignored) holds install logs, run progress logs and the last run's raw tool output.

## Reproduce

Requires Node 26 and pnpm 12, plus Python 3 on macOS for the libproc RSS helper. Step scripts are Node.js (`.mjs`).

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm run rules && pnpm run scope && pnpm run configs
pnpm run bench -- --groups A,B,C --runs 5 --warmup 1
pnpm run chart && pnpm run report
```

`05-run.mjs` accepts `--groups`, `--fixtures`, `--tools`, `--runs`, `--warmup`, `--timeout-min`. Use them to run a subset, for example `--groups A --fixtures rstack-cli --runs 1 --warmup 0` as a smoke test.

`06-report.mjs` rewrites the README between `<!-- results:start -->` and `<!-- results:end -->`. Do not edit that part by hand.

`.github/workflows/benchmark.yml` provides a manual CI refresh. It validates all fresh A/B/C data before publishing the generated files through an internal PR. `scripts/ci-contract.mjs` fixes the target and English publication text; manual dispatch with `publish_results` enabled approves that contract. The CI benchmark job has read-only repository permissions, and publication uses a separate job.

## Before benchmarking

Make sure the machine has ample free resources and nothing else interferes: no other heavy jobs, and no editors or language servers watching this directory.
