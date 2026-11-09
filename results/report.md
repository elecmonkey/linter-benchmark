# Results

| Group | Fastest tool (fixtures won) |
|---|---|
| A | **Rslint** 4/9 · **Oxlint (tsrs --fast)** 3/9 · **Oxlint (tsrs)** 1/9 · **Oxlint (tsgolint)** 1/9 |
| B | **Biome** 4/9 · **Oxlint (tsrs)** 3/9 · **Oxlint (tsrs --fast)** 2/9 |
| C | **Oxlint** 9/9 |

Runner: Linux 7.0.0-1017-azure (x64), AMD EPYC 9V74 80-Core Processor, 4 CPUs, 16 GiB RAM. Node v26.5.1, pnpm 12.18.0. [Workflow run](https://github.com/elecmonkey/linter-benchmark/actions/runs/42612909433).

The Oxlint variants use the same file scope and rule configuration. tsrs default mode uses `TSRS_FAST=0`; fast mode uses `TSRS_FAST=1`. Diagnostic counts can differ between engines and are reported separately.

## Group A: Rslint, Oxlint (tsgolint), Oxlint (tsrs), Oxlint (tsrs --fast)

68 syntactic + 23 type-aware rules. Median of 5 runs after 1 warmup. Bar lengths are log-scaled; the labels give exact values.

### [rstack-cli](https://github.com/rstackjs/rstack-cli/tree/b35a79a98d4cdb84fc9c56f7b5fb5625cb74c1c9)

**Files:** 366

![Group A, rstack-cli](charts/group-a-rstack-cli.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 870 ms | 860 ms | 898 ms | 360 MB | 468 | 1.00× |
| Oxlint (tsgolint) | 971 ms | 921 ms | 988 ms | 437 MB | 259 | 1.12× |
| Oxlint (tsrs --fast) | 1.54 s | 1.53 s | 1.59 s | 1,350 MB | 259 | 1.77× |
| Oxlint (tsrs) | 1.55 s | 1.54 s | 1.61 s | 1,352 MB | 259 | 1.78× |

### [rspack](https://github.com/web-infra-dev/rspack/tree/6c1f72b0991a7c691c8e951d6a7821b3d532f6d5)

**Files:** 493

![Group A, rspack](charts/group-a-rspack.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint (tsrs) | 871 ms | 846 ms | 874 ms | 574 MB | 3,178 | 1.00× |
| Oxlint (tsrs --fast) | 882 ms | 870 ms | 894 ms | 570 MB | 3,178 | 1.01× |
| Rslint | 1.26 s | 1.23 s | 1.28 s | 547 MB | 3,228 | 1.45× |
| Oxlint (tsgolint) | 1.42 s | 1.35 s | 1.44 s | 655 MB | 3,178 | 1.63× |

### [rsdoctor](https://github.com/web-infra-dev/rsdoctor/tree/80b2381d1a20901e1f12b3f2bb2778aaacf94f2f)

**Files:** 734

![Group A, rsdoctor](charts/group-a-rsdoctor.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint (tsrs --fast) | 1.60 s | 1.59 s | 1.62 s | 1,126 MB | 3,735 | 1.00× |
| Oxlint (tsrs) | 1.60 s | 1.60 s | 1.64 s | 1,126 MB | 3,735 | 1.00× |
| Rslint | 2.26 s | 2.20 s | 2.28 s | 706 MB | 3,743 | 1.41× |
| Oxlint (tsgolint) | 2.54 s | 2.48 s | 2.59 s | 999 MB | 3,738 | 1.59× |

### [typescript6](https://github.com/microsoft/TypeScript/tree/050880ce59e30b356b686bd3144efe24f875ebc8)

**Files:** 745

![Group A, typescript6](charts/group-a-typescript6.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 4.12 s | 4.01 s | 4.16 s | 1,076 MB | 11,741 | 1.00× |
| Oxlint (tsrs) | 4.77 s | 4.76 s | 4.86 s | 1,411 MB | 11,416 | 1.16× |
| Oxlint (tsrs --fast) | 4.83 s | 4.80 s | 5.01 s | 1,426 MB | 11,416 | 1.17× |
| Oxlint (tsgolint) | 6.84 s | 6.82 s | 6.96 s | 1,155 MB | 11,418 | 1.66× |

### [rspress](https://github.com/web-infra-dev/rspress/tree/6f87abf1d323ced2883261642561a3fc88fbd278)

**Files:** 746

![Group A, rspress](charts/group-a-rspress.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 2.05 s | 1.99 s | 2.13 s | 639 MB | 2,880 | 1.00× |
| Oxlint (tsgolint) | 2.29 s | 2.26 s | 2.35 s | 721 MB | 2,741 | 1.12× |
| Oxlint (tsrs) | 2.91 s | 2.90 s | 2.99 s | 2,185 MB | 2,741 | 1.42× |
| Oxlint (tsrs --fast) | 2.93 s | 2.89 s | 2.97 s | 2,185 MB | 2,741 | 1.43× |

### [rslib](https://github.com/web-infra-dev/rslib/tree/0734e3624dd7bfb08fdfc4ff0416404a9a551df4)

**Files:** 1,018

![Group A, rslib](charts/group-a-rslib.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 1.53 s | 1.47 s | 1.61 s | 632 MB | 663 | 1.00× |
| Oxlint (tsgolint) | 1.65 s | 1.62 s | 1.72 s | 651 MB | 675 | 1.08× |
| Oxlint (tsrs --fast) | 2.72 s | 2.70 s | 2.78 s | 2,014 MB | 674 | 1.78× |
| Oxlint (tsrs) | 2.72 s | 2.72 s | 2.76 s | 2,011 MB | 674 | 1.78× |

### [rstest](https://github.com/web-infra-dev/rstest/tree/03cabf3dd586392a6bfa4720e5a92c37281b943a)

**Files:** 2,139

![Group A, rstest](charts/group-a-rstest.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint (tsrs --fast) | 2.11 s | 2.09 s | 2.16 s | 1,457 MB | 35,913 | 1.00× |
| Oxlint (tsrs) | 2.13 s | 2.12 s | 2.14 s | 1,455 MB | 35,913 | 1.01× |
| Rslint | 2.78 s | 2.77 s | 2.82 s | 632 MB | 36,597 | 1.31× |
| Oxlint (tsgolint) | 2.90 s | 2.77 s | 3.00 s | 890 MB | 35,912 | 1.37× |

### [rsbuild](https://github.com/web-infra-dev/rsbuild/tree/622f5df2b43c12423b50ed986e0f0983c338bf91)

**Files:** 2,450

![Group A, rsbuild](charts/group-a-rsbuild.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint (tsgolint) | 2.41 s | 2.40 s | 2.67 s | 753 MB | 985 | 1.00× |
| Rslint | 2.56 s | 2.54 s | 2.73 s | 655 MB | 1,013 | 1.06× |
| Oxlint (tsrs --fast) | 3.11 s | 3.09 s | 3.29 s | 2,314 MB | 985 | 1.29× |
| Oxlint (tsrs) | 3.18 s | 3.04 s | 3.21 s | 2,324 MB | 985 | 1.32× |

### [vscode](https://github.com/microsoft/vscode/tree/f92b8f3adcd9bc034e6b9ade05c093dd59b99c5f)

**Files:** 14,258

![Group A, vscode](charts/group-a-vscode.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint (tsrs --fast) | 22.0 s | 21.8 s | 22.3 s | 6,295 MB | 163,615 | 1.00× |
| Oxlint (tsrs) | 24.1 s | 21.9 s | 28.8 s | 6,840 MB | 163,615 | 1.10× |
| Rslint | 68.8 s | 62.1 s | 73.4 s | 14,262 MB | 168,683 | 3.13× |
| Oxlint (tsgolint) | 73.8 s | 60.3 s | 81.3 s | 14,797 MB | 163,428 | 3.36× |

## Group B: Rslint, Oxlint (tsgolint), Oxlint (tsrs), Oxlint (tsrs --fast), Biome

57 syntactic + 9 type-aware rules. Median of 5 runs after 1 warmup. Bar lengths are log-scaled; the labels give exact values.

### [rstack-cli](https://github.com/rstackjs/rstack-cli/tree/b35a79a98d4cdb84fc9c56f7b5fb5625cb74c1c9)

**Files:** 366

![Group B, rstack-cli](charts/group-b-rstack-cli.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Biome | 551 ms | 541 ms | 597 ms | 284 MB | 22 | 1.00× |
| Rslint | 879 ms | 867 ms | 898 ms | 346 MB | 25 | 1.60× |
| Oxlint (tsgolint) | 993 ms | 942 ms | 1.01 s | 463 MB | 36 | 1.80× |
| Oxlint (tsrs) | 1.57 s | 1.57 s | 1.61 s | 1,350 MB | 36 | 2.86× |
| Oxlint (tsrs --fast) | 1.58 s | 1.58 s | 1.59 s | 1,341 MB | 36 | 2.87× |

### [rspack](https://github.com/web-infra-dev/rspack/tree/6c1f72b0991a7c691c8e951d6a7821b3d532f6d5)

**Files:** 493

![Group B, rspack](charts/group-b-rspack.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint (tsrs) | 835 ms | 830 ms | 843 ms | 562 MB | 998 | 1.00× |
| Oxlint (tsrs --fast) | 843 ms | 838 ms | 853 ms | 565 MB | 998 | 1.01× |
| Biome | 1.17 s | 1.17 s | 1.18 s | 489 MB | 936 | 1.40× |
| Rslint | 1.19 s | 1.19 s | 1.22 s | 455 MB | 1,021 | 1.43× |
| Oxlint (tsgolint) | 1.30 s | 1.23 s | 1.31 s | 604 MB | 998 | 1.55× |

### [rsdoctor](https://github.com/web-infra-dev/rsdoctor/tree/80b2381d1a20901e1f12b3f2bb2778aaacf94f2f)

**Files:** 734

![Group B, rsdoctor](charts/group-b-rsdoctor.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint (tsrs --fast) | 1.57 s | 1.54 s | 1.61 s | 1,114 MB | 613 | 1.00× |
| Oxlint (tsrs) | 1.58 s | 1.55 s | 1.59 s | 1,122 MB | 613 | 1.01× |
| Biome | 1.63 s | 1.60 s | 1.65 s | 670 MB | 562 | 1.04× |
| Rslint | 2.16 s | 2.14 s | 2.28 s | 660 MB | 625 | 1.38× |
| Oxlint (tsgolint) | 2.35 s | 2.29 s | 2.45 s | 845 MB | 613 | 1.50× |

### [typescript6](https://github.com/microsoft/TypeScript/tree/050880ce59e30b356b686bd3144efe24f875ebc8)

**Files:** 745

![Group B, typescript6](charts/group-b-typescript6.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint (tsrs) | 2.52 s | 2.45 s | 2.53 s | 1,395 MB | 1,885 | 1.00× |
| Oxlint (tsrs --fast) | 2.53 s | 2.49 s | 2.57 s | 1,409 MB | 1,885 | 1.00× |
| Rslint | 3.50 s | 3.30 s | 3.61 s | 1,016 MB | 2,213 | 1.39× |
| Oxlint (tsgolint) | 3.83 s | 3.81 s | 3.96 s | 1,041 MB | 1,885 | 1.52× |
| Biome | 13.2 s | 13.0 s | 13.4 s | 2,316 MB | 2,334 | 5.23× |

### [rspress](https://github.com/web-infra-dev/rspress/tree/6f87abf1d323ced2883261642561a3fc88fbd278)

**Files:** 746

![Group B, rspress](charts/group-b-rspress.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Biome | 1.29 s | 1.27 s | 1.29 s | 553 MB | 179 | 1.00× |
| Rslint | 2.04 s | 2.01 s | 2.08 s | 628 MB | 190 | 1.59× |
| Oxlint (tsgolint) | 2.25 s | 2.19 s | 2.30 s | 770 MB | 187 | 1.74× |
| Oxlint (tsrs) | 2.97 s | 2.90 s | 2.98 s | 2,172 MB | 187 | 2.31× |
| Oxlint (tsrs --fast) | 2.98 s | 2.96 s | 3.06 s | 2,175 MB | 187 | 2.31× |

### [rslib](https://github.com/web-infra-dev/rslib/tree/0734e3624dd7bfb08fdfc4ff0416404a9a551df4)

**Files:** 1,018

![Group B, rslib](charts/group-b-rslib.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Biome | 1.38 s | 1.35 s | 1.44 s | 583 MB | 203 | 1.00× |
| Rslint | 1.54 s | 1.52 s | 1.57 s | 607 MB | 186 | 1.12× |
| Oxlint (tsgolint) | 1.69 s | 1.68 s | 1.74 s | 737 MB | 208 | 1.23× |
| Oxlint (tsrs) | 2.79 s | 2.75 s | 2.81 s | 2,015 MB | 207 | 2.02× |
| Oxlint (tsrs --fast) | 2.80 s | 2.78 s | 2.81 s | 2,003 MB | 207 | 2.03× |

### [rstest](https://github.com/web-infra-dev/rstest/tree/03cabf3dd586392a6bfa4720e5a92c37281b943a)

**Files:** 2,139

![Group B, rstest](charts/group-b-rstest.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint (tsrs) | 1.95 s | 1.93 s | 1.99 s | 1,427 MB | 1,521 | 1.00× |
| Oxlint (tsrs --fast) | 1.95 s | 1.92 s | 1.98 s | 1,413 MB | 1,521 | 1.00× |
| Biome | 2.24 s | 2.15 s | 2.28 s | 759 MB | 1,606 | 1.15× |
| Rslint | 2.57 s | 2.47 s | 2.59 s | 605 MB | 1,578 | 1.32× |
| Oxlint (tsgolint) | 2.57 s | 2.49 s | 2.69 s | 882 MB | 1,521 | 1.32× |

### [rsbuild](https://github.com/web-infra-dev/rsbuild/tree/622f5df2b43c12423b50ed986e0f0983c338bf91)

**Files:** 2,450

![Group B, rsbuild](charts/group-b-rsbuild.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Biome | 1.28 s | 1.27 s | 1.28 s | 277 MB | 155 | 1.00× |
| Oxlint (tsgolint) | 2.38 s | 2.32 s | 2.52 s | 759 MB | 95 | 1.86× |
| Rslint | 2.57 s | 2.51 s | 2.65 s | 644 MB | 82 | 2.01× |
| Oxlint (tsrs) | 3.11 s | 3.09 s | 3.28 s | 2,313 MB | 95 | 2.43× |
| Oxlint (tsrs --fast) | 3.15 s | 3.12 s | 3.17 s | 2,308 MB | 95 | 2.46× |

### [vscode](https://github.com/microsoft/vscode/tree/f92b8f3adcd9bc034e6b9ade05c093dd59b99c5f)

**Files:** 14,258

![Group B, vscode](charts/group-b-vscode.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint (tsrs --fast) | 17.7 s | 17.6 s | 17.8 s | 5,886 MB | 50,345 | 1.00× |
| Oxlint (tsrs) | 17.9 s | 17.9 s | 18.0 s | 6,361 MB | 50,345 | 1.01× |
| Oxlint (tsgolint) | 51.1 s | 47.5 s | 57.2 s | 13,734 MB | 50,345 | 2.89× |
| Rslint | 52.9 s | 50.7 s | 53.6 s | 13,436 MB | 55,064 | 2.99× |
| Biome | 97.3 s | 96.4 s | 99.8 s | 14,334 MB | 43,921 | 5.50× |

## Group C: Rslint, Oxlint, Biome

56 syntactic rules, no type information. Median of 5 runs after 1 warmup. Bar lengths are log-scaled; the labels give exact values.

### [rstack-cli](https://github.com/rstackjs/rstack-cli/tree/b35a79a98d4cdb84fc9c56f7b5fb5625cb74c1c9)

**Files:** 366

![Group C, rstack-cli](charts/group-c-rstack-cli.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint | 65 ms | 49 ms | 66 ms | N/A | 0 | 1.00× |
| Biome | 134 ms | 131 ms | 143 ms | 85 MB | 13 | 2.05× |
| Rslint | 186 ms | 178 ms | 197 ms | 114 MB | 0 | 2.86× |

### [rspack](https://github.com/web-infra-dev/rspack/tree/6c1f72b0991a7c691c8e951d6a7821b3d532f6d5)

**Files:** 493

![Group C, rspack](charts/group-c-rspack.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint | 140 ms | 134 ms | 144 ms | 129 MB | 625 | 1.00× |
| Biome | 288 ms | 284 ms | 289 ms | 154 MB | 809 | 2.06× |
| Rslint | 314 ms | 301 ms | 315 ms | 160 MB | 624 | 2.25× |

### [rsdoctor](https://github.com/web-infra-dev/rsdoctor/tree/80b2381d1a20901e1f12b3f2bb2778aaacf94f2f)

**Files:** 734

![Group C, rsdoctor](charts/group-c-rsdoctor.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint | 76 ms | 74 ms | 81 ms | N/A | 297 | 1.00× |
| Biome | 259 ms | 256 ms | 268 ms | 132 MB | 357 | 3.41× |
| Rslint | 318 ms | 305 ms | 345 ms | 174 MB | 291 | 4.18× |

### [typescript6](https://github.com/microsoft/TypeScript/tree/050880ce59e30b356b686bd3144efe24f875ebc8)

**Files:** 745

![Group C, typescript6](charts/group-c-typescript6.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint | 381 ms | 377 ms | 387 ms | 280 MB | 1,526 | 1.00× |
| Rslint | 1.14 s | 1.12 s | 1.19 s | 453 MB | 1,530 | 2.99× |
| Biome | 8.49 s | 8.16 s | 8.66 s | 1,900 MB | 2,226 | 22.27× |

### [rspress](https://github.com/web-infra-dev/rspress/tree/6f87abf1d323ced2883261642561a3fc88fbd278)

**Files:** 746

![Group C, rspress](charts/group-c-rspress.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint | 76 ms | 73 ms | 85 ms | 99 MB | 50 | 1.00× |
| Biome | 250 ms | 249 ms | 254 ms | 125 MB | 92 | 3.30× |
| Rslint | 320 ms | 315 ms | 329 ms | 164 MB | 47 | 4.21× |

### [rslib](https://github.com/web-infra-dev/rslib/tree/0734e3624dd7bfb08fdfc4ff0416404a9a551df4)

**Files:** 1,018

![Group C, rslib](charts/group-c-rslib.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint | 71 ms | 67 ms | 76 ms | 104 MB | 67 | 1.00× |
| Biome | 226 ms | 221 ms | 228 ms | 106 MB | 98 | 3.18× |
| Rslint | 315 ms | 306 ms | 328 ms | 147 MB | 47 | 4.44× |

### [rstest](https://github.com/web-infra-dev/rstest/tree/03cabf3dd586392a6bfa4720e5a92c37281b943a)

**Files:** 2,139

![Group C, rstest](charts/group-c-rstest.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint | 117 ms | 114 ms | 124 ms | 121 MB | 757 | 1.00× |
| Biome | 635 ms | 626 ms | 639 ms | 226 MB | 1,208 | 5.44× |
| Rslint | 699 ms | 687 ms | 724 ms | 283 MB | 755 | 5.98× |

### [rsbuild](https://github.com/web-infra-dev/rsbuild/tree/622f5df2b43c12423b50ed986e0f0983c338bf91)

**Files:** 2,450

![Group C, rsbuild](charts/group-c-rsbuild.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint | 96 ms | 92 ms | 101 ms | 108 MB | 50 | 1.00× |
| Biome | 437 ms | 434 ms | 440 ms | 141 MB | 119 | 4.58× |
| Rslint | 560 ms | 548 ms | 567 ms | 220 MB | 45 | 5.87× |

### [vscode](https://github.com/microsoft/vscode/tree/f92b8f3adcd9bc034e6b9ade05c093dd59b99c5f)

**Files:** 14,258

![Group C, vscode](charts/group-c-vscode.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Oxlint | 1.40 s | 1.40 s | 1.42 s | 245 MB | 10,260 | 1.00× |
| Rslint | 12.0 s | 11.1 s | 12.5 s | 5,614 MB | 10,291 | 8.58× |
| Biome | 16.8 s | 16.6 s | 16.9 s | 5,950 MB | 18,600 | 11.98× |
