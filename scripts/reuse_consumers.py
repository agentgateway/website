#!/usr/bin/env python3
"""Which content pages read a given assets file, following `reuse` all the way up.

WHY THIS EXISTS

`doc-tests.yaml` only runs the tests belonging to the pages a pull request
changed. Most prose in this repo does not live on a page: it lives in
`assets/agw-docs/` and a page pulls it in with `{{< reuse "..." >}}`. So the
workflow has to answer "a snippet changed, which pages does that affect", and
it used to answer it by MIRRORING THE PATH: strip `assets/agw-docs/pages/`, then
try the remainder under each version root, with and without a `documentation/`
segment.

That is a guess, and it is wrong in two ways that both fail silently.

  1. It only knows two prefixes, and only looks at `assets/agw-docs/pages/`
     at all. A snippet whose page sits under `integrations/` mirrors to
     nothing, and a snippet somewhere else under `assets/` is never even
     tried.

  2. A page does not have to mirror the snippet's path AT ALL, and reuse
     nests. `llm/providers/openai.md` is pulled in by
     `quickstart/llm.md` -- another snippet -- which is pulled in by
     `content/docs/kubernetes/main/documentation/quickstart/llm.md`. No path
     mirror can find that, because the two paths have nothing in common.

The symptom is a green check that ran nothing. 62 of the 134 snippets that
carry doc tests cannot be resolved by the mirror, so editing one of them
selects zero tests and the job reports success. That is worse than a red build: it is a check that
cannot fail, on exactly the files whose tests matter most, since a snippet is
shared by many pages.

WHAT THIS DOES INSTEAD

Reads the reuse edges out of the files themselves and walks them backwards.
No guessing about layout, so moving a page or adding a section cannot quietly
switch a test off again.

Transitive on purpose, and the openai case above is why: one hop would still
miss it.

A NOTE ON WHAT IS *NOT* USED HERE

`doc_test_extract.py` already resolves reuse, and records the edges as it goes.
Asking it would mean running the whole extraction -- 468 scripts -- to recover
a fact that a regex over the same files gives in under a second, so the edges
are re-derived rather than borrowed. The shortcode syntax it matches is
deliberately copied from that module, and the two need to stay in step: if
`doc_test_extract` learns a new inclusion shortcode, this needs it too, or the
tests for whatever that shortcode pulls in go quiet in the same silent way.

WHERE THIS DELIBERATELY DIVERGES FROM `doc_test_extract`

It over-selects, in one known way. `doc_test_extract` strips `{{< version >}}`
blocks whose condition is false BEFORE it resolves the reuse shortcodes inside
them, so a reuse that only applies to one version tree is not an edge for the
others. This walks every edge regardless of version gating, so a page can be
selected whose expansion turns out not to contain the changed snippet after
all.

That direction is the safe one -- the page is handed to `doc_test_run.py`,
which expands it properly and finds no tests to run -- and it is the right
default for a selector: guessing wide costs a little CI time, guessing narrow
costs a check. Do not "fix" this by teaching the regex about version blocks
without first checking which way the resulting error leans.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]

# Matches `{{< reuse "agw-docs/..." >}}` and the `{{% ... %}}` form, plus
# `reuse-append`. Copied from `doc_test_extract.py`'s pattern so the two agree
# on what counts as an inclusion; see the note in the module docstring.
REUSE_RE = re.compile(r"""\{\{[<%]\s*(?:reuse|reuse-append)\s+"([^"]+)"\s*[>%]\}\}""")

# The OTHER inclusion shortcode `doc_test_extract` follows. It has no uses in
# the tree today, so this matches nothing and is pure insurance: the module
# docstring promises the two stay in step, and a promise that is only kept
# while nobody exercises it is the same silent-gap bug in a new place. The
# first `{{< include >}}` somebody writes would otherwise take that page's
# tests dark, and nothing would say so.
INCLUDE_RE = re.compile(r"""\{\{[<%]\s*include\s+"([^"]+)"\s*[>%]\}\}""")

# A reuse target is written relative to `assets/`, uniformly: every one of the
# 9,405 in the tree today starts `agw-docs/`. Resolved from that single base
# rather than probed, because a target that does not resolve is a broken
# shortcode and should look like one.
ASSETS_DIR = "assets"
CONTENT_DIR = "content"


def _include_candidates(target: str) -> list[str]:
    """The paths an `{{< include "x" >}}` could name, in the order tried.

    Mirrors `doc_test_extract._resolve_include`: the target is relative to
    `content/`, and a target without a `.md` suffix means either the file or
    the section index. Probed rather than resolved from one base, unlike
    reuse, because that is what the extractor does and the point of this
    function is to agree with it.
    """
    rel = target.strip().strip("/")
    base = f"{CONTENT_DIR}/{rel}"
    if rel.endswith(".md"):
        return [base]
    return [f"{base}.md", f"{base}/_index.md"]


def inclusion_targets(path: pathlib.Path, root: pathlib.Path) -> set[str]:
    """The repo-relative paths this file pulls in directly, by either shortcode."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return set()
    targets = {f"{ASSETS_DIR}/{m}" for m in REUSE_RE.findall(text)}
    for m in INCLUDE_RE.findall(text):
        for candidate in _include_candidates(m):
            if (root / candidate).exists():
                targets.add(candidate)
                break
    return targets


def build_reverse_index(root: pathlib.Path) -> dict[str, set[str]]:
    """``included file -> {files that include it}``, over content/ and assets/.

    Both trees, because a snippet including another snippet is the middle of
    the chain this exists to walk. Indexing only `content/` would find the last
    hop and miss everything above it.
    """
    index: dict[str, set[str]] = {}
    for base in (CONTENT_DIR, ASSETS_DIR):
        for md in (root / base).rglob("*.md"):
            src = md.relative_to(root).as_posix()
            for target in inclusion_targets(md, root):
                index.setdefault(target, set()).add(src)
    return index


def consumers(
    changed: list[str], index: dict[str, set[str]], content_prefix: str = "content/"
) -> list[str]:
    """Every content page that reaches any of ``changed`` through reuse.

    Breadth-first up the graph, with a `seen` set. The set is not just an
    optimization: `agw-docs/snippets/agentgateway.md` is reused by most of the
    tree, so a repeated visit is the normal case rather than a cycle, and
    without it this walks the same subtree thousands of times.

    A changed path that is already a content page is returned as itself. The
    caller passes the whole changed-file list, and a page that both changed
    directly and is reached through a snippet must not be dropped by whichever
    branch happens to run second.
    """
    seen: set[str] = set()
    queue = list(changed)
    found: set[str] = set()
    while queue:
        current = queue.pop()
        if current in seen:
            continue
        seen.add(current)
        if current.startswith(content_prefix):
            found.add(current)
            # No `continue`. A content page can itself be reused -- the version
            # trees do it -- so the walk goes on past it.
        queue.extend(index.get(current, ()))
    return sorted(found)


DOC_TEST_MARKER = "{{< doc-test"


def carries_doc_tests(path: pathlib.Path) -> bool:
    """Whether this file defines doc tests of its own."""
    try:
        return DOC_TEST_MARKER in path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False


def unresolved(changed: list[str], index: dict[str, set[str]]) -> list[str]:
    """The changed files that reach no content page at all.

    Attributed one file at a time, because the whole-list answer cannot say
    WHICH input went nowhere, and "some of your snippets select nothing" is
    not actionable. The per-file walks are redundant with each other and with
    the combined one; over every snippet in the tree at once the whole pass
    is still under half a second, which is the right trade for a named
    warning.

    Expected to be non-empty sometimes: 125 of the 585 snippets in the tree
    reach no page. Reported, never raised -- a selector that reds the build
    on a legitimate orphan edit teaches people to ignore it.
    """
    return [c for c in changed if not consumers([c], index)]


def unresolved_losing_tests(
    changed: list[str], index: dict[str, set[str]], root: pathlib.Path
) -> list[str]:
    """Unresolved changed files that had tests to lose. The warning-worthy set.

    Warning on every unresolved file would fire on 125 orphans, and a warning
    that fires on routine edits is one people learn to scroll past -- which is
    precisely how the old "No content candidates found" line survived as long
    as it did. So it is narrowed to the case where something is actually lost.

    A file reaching no page can only cost its OWN tests. Its consumers are by
    definition none, and the snippets IT reuses are reached from their pages,
    not through this one, so their tests are unaffected by this edit. Which
    makes "unresolved AND carries doc tests" exactly the set worth a warning,
    and the same set the budget test in `test_reuse_consumers.py` pins at 5.
    """
    return [c for c in unresolved(changed, index) if carries_doc_tests(root / c)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "files", nargs="*", help="changed paths, relative to the repo root"
    )
    parser.add_argument("--repo-root", default=str(REPO_ROOT))
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="read the changed paths from stdin, one per line, instead of argv",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="do not report changed files that reach no page (stderr)",
    )
    args = parser.parse_args()

    changed = list(args.files)
    if args.stdin:
        changed += [line.strip() for line in sys.stdin if line.strip()]
    if not changed:
        return 0

    root = pathlib.Path(args.repo_root).resolve()
    # Only markdown participates in reuse, and the changed-file list is the
    # whole pull request. Filtering here rather than in the caller keeps the
    # shell side of this a single pipe.
    changed = [c for c in changed if c.endswith(".md")]
    if not changed:
        return 0

    index = build_reverse_index(root)
    for page in consumers(changed, index):
        print(page)

    # To stderr, so the page list on stdout stays pipeable. A file with tests
    # that selects nothing is the exact symptom of the bug this replaced, and
    # the old code did print it -- as "No content candidates found", buried in
    # a green log nobody opened. Naming it, and only when something is lost,
    # is what makes the difference; the caller decides how loud to be.
    if not args.quiet:
        for path in unresolved_losing_tests(changed, index, root):
            print(f"has doc tests but reaches no content page: {path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
