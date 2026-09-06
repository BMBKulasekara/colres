# Template licensing

Every entry in the built-in catalog (`templateCatalog.ts`) declares a `license`
block. That block describes the **LaTeX document class** the template targets —
not the sample prose in the template body, which is original to this project.

## Ground rules

1. **All sample prose in this repository is written for this project.** Publisher
   sample text — ACM's "This document is a model and instructions for LaTeX…",
   IEEE's boilerplate author blocks, Springer's example abstracts — is covered by
   the publisher's own terms even where the class file is LPPL. None of it is
   copied here, and none should be added.

2. **Do not scrape the Overleaf gallery.** Templates there carry individual
   licences, many of which forbid redistribution. Take class files from
   [CTAN](https://ctan.org), which is the canonical, licence-clear source.

3. **`redistributable: false` means the class file may not ship with the app.**
   Those templates still work for drafting, because drafting happens in rich
   text. When the LaTeX export is built, such a class must be fetched from its
   publisher at export time rather than vendored into this repository.

## Class files referenced by the built-in catalog

No class files are currently vendored — the app does not compile LaTeX yet.
This table records what each template targets, so the export path knows where to
obtain it.

| Template | Class | Licence | Redistributable | Source |
| --- | --- | --- | --- | --- |
| Basic Academic Article | `article` | LPPL-1.3c | Yes | Stock LaTeX |
| Literature Review | `article` | LPPL-1.3c | Yes | Stock LaTeX |
| Research Proposal | `article` | LPPL-1.3c | Yes | Stock LaTeX |
| Lab Report / Assignment | `article` | LPPL-1.3c | Yes | Stock LaTeX |
| Thesis / Dissertation | `report` | LPPL-1.3c | Yes | Stock LaTeX |
| Conference Presentation | `beamer` | LPPL-1.3c | Yes | https://ctan.org/pkg/beamer |
| IEEE Conference Paper | `IEEEtran` | LPPL-1.3 | Yes, unmodified | https://ctan.org/pkg/ieeetran |
| IEEE Transactions Article | `IEEEtran` | LPPL-1.3 | Yes, unmodified | https://ctan.org/pkg/ieeetran |
| ACM Conference Paper | `acmart` | LPPL-1.3 (class only) | Class yes, sample text no | https://ctan.org/pkg/acmart |
| Elsevier Journal Article | `elsarticle` | LPPL-1.3 | Yes | https://ctan.org/pkg/elsarticle |
| Springer LNCS Paper | `llncs` | Springer's own terms | **No** | https://www.springer.com/gp/computer-science/lncs |

## Adding a template

When adding one — in this file or through the admin panel — record the class
licence honestly. Set `redistributable: false` whenever you are unsure: the cost
of that is one extra fetch at export time, whereas the cost of being wrong the
other way is shipping a file you had no right to distribute.
