# Results

| Group | Fastest tool (fixtures won) |
|---|---|
| A | **Rslint** 9/9 |
| B | **Rslint** 9/9 |

## Group A: ESLint (typescript-eslint), Rslint, Oxlint (oxlint-tsgolint)

68 syntactic + 23 type-aware rules. Median of 5 runs after 1 warmup. Bar lengths are log-scaled; the labels give exact values.

### [rstack-cli](https://github.com/rstackjs/rstack-cli/tree/b35a79a98d4cdb84fc9c56f7b5fb5625cb74c1c9)

**Files:** 366

![Group A, rstack-cli](charts/group-a-rstack-cli.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 378 ms | 354 ms | 398 ms | 367 MB | 468 | 1.00× |
| Oxlint (oxlint-tsgolint) | 583 ms | 553 ms | 603 ms | 464 MB | 259 | 1.54× |
| ESLint (typescript-eslint) | 11.5 s | 11.3 s | 11.5 s | 5,229 MB | 468 | 30.45× |

### [rspack](https://github.com/web-infra-dev/rspack/tree/6c1f72b0991a7c691c8e951d6a7821b3d532f6d5)

**Files:** 499

![Group A, rspack](charts/group-a-rspack.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 494 ms | 451 ms | 527 ms | 639 MB | 3,228 | 1.00× |
| Oxlint (oxlint-tsgolint) | 735 ms | 708 ms | 807 ms | 660 MB | 3,178 | 1.49× |
| ESLint (typescript-eslint) | 6.70 s | 6.64 s | 6.79 s | 2,302 MB | 3,231 | 13.54× |

### [rsdoctor](https://github.com/web-infra-dev/rsdoctor/tree/80b2381d1a20901e1f12b3f2bb2778aaacf94f2f)

**Files:** 734

![Group A, rsdoctor](charts/group-a-rsdoctor.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 685 ms | 667 ms | 773 ms | 894 MB | 3,743 | 1.00× |
| Oxlint (oxlint-tsgolint) | 1.11 s | 1.06 s | 1.18 s | 770 MB | 3,738 | 1.62× |
| ESLint (typescript-eslint) | 13.7 s | 13.6 s | 13.7 s | 4,067 MB | 3,739 | 19.95× |

### [typescript6](https://github.com/microsoft/TypeScript/tree/050880ce59e30b356b686bd3144efe24f875ebc8)

**Files:** 745

![Group A, typescript6](charts/group-a-typescript6.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 1.04 s | 1.00 s | 1.07 s | 1,324 MB | 11,741 | 1.00× |
| Oxlint (oxlint-tsgolint) | 3.81 s | 3.76 s | 3.86 s | 1,219 MB | 11,418 | 3.66× |
| ESLint (typescript-eslint) | 20.5 s | 20.1 s | 20.7 s | 4,648 MB | 11,862 | 19.71× |

### [rspress](https://github.com/web-infra-dev/rspress/tree/6f87abf1d323ced2883261642561a3fc88fbd278)

**Files:** 746

![Group A, rspress](charts/group-a-rspress.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 648 ms | 612 ms | 705 ms | 708 MB | 2,880 | 1.00× |
| Oxlint (oxlint-tsgolint) | 1.19 s | 1.13 s | 1.29 s | 757 MB | 2,741 | 1.84× |
| ESLint (typescript-eslint) | 22.2 s | 21.9 s | 22.5 s | 8,316 MB | 2,888 | 34.28× |

### [rslib](https://github.com/web-infra-dev/rslib/tree/0734e3624dd7bfb08fdfc4ff0416404a9a551df4)

**Files:** 1,018

![Group A, rslib](charts/group-a-rslib.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 569 ms | 562 ms | 613 ms | 602 MB | 663 | 1.00× |
| Oxlint (oxlint-tsgolint) | 1.07 s | 1.04 s | 1.12 s | 680 MB | 685 | 1.88× |
| ESLint (typescript-eslint) | 21.0 s | 20.8 s | 21.8 s | 8,167 MB | 696 | 36.85× |

### [rstest](https://github.com/web-infra-dev/rstest/tree/03cabf3dd586392a6bfa4720e5a92c37281b943a)

**Files:** 2,139

![Group A, rstest](charts/group-a-rstest.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 841 ms | 825 ms | 1.70 s | 880 MB | 36,597 | 1.00× |
| Oxlint (oxlint-tsgolint) | 1.37 s | 1.33 s | 1.52 s | 896 MB | 36,074 | 1.63× |
| ESLint (typescript-eslint) | 21.7 s | 21.2 s | 22.1 s | 6,810 MB | 36,604 | 25.81× |

### [rsbuild](https://github.com/web-infra-dev/rsbuild/tree/622f5df2b43c12423b50ed986e0f0983c338bf91)

**Files:** 2,448

![Group A, rsbuild](charts/group-a-rsbuild.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 760 ms | 738 ms | 816 ms | 935 MB | 1,013 | 1.00× |
| Oxlint (oxlint-tsgolint) | 1.41 s | 1.35 s | 1.52 s | 712 MB | 985 | 1.85× |
| ESLint (typescript-eslint) | 27.7 s | 27.5 s | 28.5 s | 8,679 MB | 1,014 | 36.49× |

### [vscode](https://github.com/microsoft/vscode/tree/f92b8f3adcd9bc034e6b9ade05c093dd59b99c5f)

**Files:** 14,260

![Group A, vscode](charts/group-a-vscode.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 14.5 s | 14.3 s | 14.8 s | 13,286 MB | 168,683 | 1.00× |
| Oxlint (oxlint-tsgolint) | 16.3 s | 15.9 s | 17.3 s | 14,579 MB | 163,428 | 1.13× |
| ESLint (typescript-eslint) | 593.4 s | 524.0 s | 733.5 s | 23,916 MB | 169,795 | 41.03× |

## Group B: ESLint (typescript-eslint), Rslint, Oxlint (oxlint-tsgolint), Biome

57 syntactic + 9 type-aware rules. Median of 5 runs after 1 warmup. Bar lengths are log-scaled; the labels give exact values.

### [rstack-cli](https://github.com/rstackjs/rstack-cli/tree/b35a79a98d4cdb84fc9c56f7b5fb5625cb74c1c9)

**Files:** 366

![Group B, rstack-cli](charts/group-b-rstack-cli.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 356 ms | 355 ms | 368 ms | 332 MB | 25 | 1.00× |
| Biome | 558 ms | 531 ms | 578 ms | 412 MB | 22 | 1.57× |
| Oxlint (oxlint-tsgolint) | 588 ms | 552 ms | 611 ms | 464 MB | 36 | 1.65× |
| ESLint (typescript-eslint) | 10.7 s | 10.6 s | 10.7 s | 5,176 MB | 25 | 29.97× |

### [rspack](https://github.com/web-infra-dev/rspack/tree/6c1f72b0991a7c691c8e951d6a7821b3d532f6d5)

**Files:** 499

![Group B, rspack](charts/group-b-rspack.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 443 ms | 434 ms | 459 ms | 578 MB | 1,021 | 1.00× |
| Oxlint (oxlint-tsgolint) | 713 ms | 703 ms | 713 ms | 640 MB | 998 | 1.61× |
| Biome | 1.02 s | 990 ms | 1.08 s | 622 MB | 936 | 2.30× |
| ESLint (typescript-eslint) | 6.01 s | 5.98 s | 6.17 s | 2,235 MB | 1,023 | 13.59× |

### [rsdoctor](https://github.com/web-infra-dev/rsdoctor/tree/80b2381d1a20901e1f12b3f2bb2778aaacf94f2f)

**Files:** 734

![Group B, rsdoctor](charts/group-b-rsdoctor.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 661 ms | 635 ms | 686 ms | 867 MB | 625 | 1.00× |
| Oxlint (oxlint-tsgolint) | 1.00 s | 982 ms | 1.03 s | 787 MB | 613 | 1.51× |
| Biome | 1.43 s | 1.37 s | 1.44 s | 865 MB | 562 | 2.16× |
| ESLint (typescript-eslint) | 12.4 s | 12.3 s | 12.4 s | 4,256 MB | 626 | 18.75× |

### [typescript6](https://github.com/microsoft/TypeScript/tree/050880ce59e30b356b686bd3144efe24f875ebc8)

**Files:** 745

![Group B, typescript6](charts/group-b-typescript6.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 841 ms | 819 ms | 853 ms | 1,184 MB | 2,213 | 1.00× |
| Oxlint (oxlint-tsgolint) | 1.55 s | 1.49 s | 1.60 s | 1,114 MB | 1,885 | 1.84× |
| Biome | 6.10 s | 5.97 s | 6.29 s | 2,614 MB | 2,334 | 7.25× |
| ESLint (typescript-eslint) | 16.3 s | 16.0 s | 17.5 s | 4,479 MB | 2,331 | 19.36× |

### [rspress](https://github.com/web-infra-dev/rspress/tree/6f87abf1d323ced2883261642561a3fc88fbd278)

**Files:** 746

![Group B, rspress](charts/group-b-rspress.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 596 ms | 571 ms | 657 ms | 710 MB | 190 | 1.00× |
| Oxlint (oxlint-tsgolint) | 1.09 s | 1.05 s | 1.17 s | 727 MB | 187 | 1.82× |
| Biome | 1.21 s | 1.11 s | 1.24 s | 1,097 MB | 179 | 2.02× |
| ESLint (typescript-eslint) | 20.7 s | 20.7 s | 21.0 s | 7,966 MB | 198 | 34.79× |

### [rslib](https://github.com/web-infra-dev/rslib/tree/0734e3624dd7bfb08fdfc4ff0416404a9a551df4)

**Files:** 1,018

![Group B, rslib](charts/group-b-rslib.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 547 ms | 516 ms | 572 ms | 611 MB | 186 | 1.00× |
| Oxlint (oxlint-tsgolint) | 952 ms | 943 ms | 1.09 s | 755 MB | 214 | 1.74× |
| Biome | 1.17 s | 1.14 s | 1.22 s | 729 MB | 203 | 2.14× |
| ESLint (typescript-eslint) | 20.3 s | 20.1 s | 20.5 s | 8,116 MB | 213 | 37.10× |

### [rstest](https://github.com/web-infra-dev/rstest/tree/03cabf3dd586392a6bfa4720e5a92c37281b943a)

**Files:** 2,139

![Group B, rstest](charts/group-b-rstest.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 705 ms | 688 ms | 734 ms | 781 MB | 1,578 | 1.00× |
| Oxlint (oxlint-tsgolint) | 1.23 s | 1.15 s | 1.23 s | 853 MB | 1,535 | 1.74× |
| Biome | 1.79 s | 1.77 s | 1.89 s | 1,100 MB | 1,606 | 2.53× |
| ESLint (typescript-eslint) | 19.1 s | 18.9 s | 19.5 s | 6,668 MB | 1,585 | 27.05× |

### [rsbuild](https://github.com/web-infra-dev/rsbuild/tree/622f5df2b43c12423b50ed986e0f0983c338bf91)

**Files:** 2,448

![Group B, rsbuild](charts/group-b-rsbuild.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 748 ms | 726 ms | 772 ms | 901 MB | 82 | 1.00× |
| Biome | 794 ms | 708 ms | 797 ms | 468 MB | 155 | 1.06× |
| Oxlint (oxlint-tsgolint) | 1.36 s | 1.33 s | 1.40 s | 711 MB | 95 | 1.81× |
| ESLint (typescript-eslint) | 26.8 s | 26.8 s | 27.0 s | 8,685 MB | 106 | 35.91× |

### [vscode](https://github.com/microsoft/vscode/tree/f92b8f3adcd9bc034e6b9ade05c093dd59b99c5f)

**Files:** 14,260

![Group B, vscode](charts/group-b-vscode.svg)

| Tool | Median | Min | Max | Peak RSS | Diagnostics | Relative |
|---|--:|--:|--:|--:|--:|--:|
| Rslint | 12.2 s | 11.9 s | 29.8 s | 11,426 MB | 55,064 | 1.00× |
| Oxlint (oxlint-tsgolint) | 13.5 s | 13.3 s | 14.0 s | 13,303 MB | 50,345 | 1.10× |
| Biome | 22.4 s | 21.6 s | 23.3 s | 17,841 MB | 43,921 | 1.83× |
| ESLint (typescript-eslint) | 487.6 s | 414.4 s | 499.6 s | 23,735 MB | 56,163 | 39.82× |
