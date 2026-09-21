#!/usr/bin/env python3
"""Which content pages a change affects: what reuses it, and what tests it.

Two relations, and only one of them chains. `consumers` is the entry point and
explains the split; `build_test_dependency_index` explains why merging them
selects most of the suite.

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

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

# Imported, NOT reimplemented. These two decide what a `file:` entry in a
# `test:` block actually points at, and a second copy of that logic here would
# drift from the runner's copy silently -- which is the failure this whole
# script exists to stop. Neither module does anything at import time.
from doc_test_run import parse_front_matter, version_path_tokens  # noqa: E402

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


def test_dependency_targets(page_rel: str, root: pathlib.Path) -> set[str]:
    """The files this page's `test:` block pulls its setup steps from.

    A SECOND KIND OF EDGE, and reuse cannot see it. A test is assembled from
    steps on other pages, named in front matter:

        test:
          claim-level-rate-limit:
          - file: ${versionRoot}/documentation/install/helm.md
            path: standard

    So `install/helm.md` is part of 142 tests declared on pages that never
    reuse a line of it. Walking only reuse, a change to the install guide
    selects the install guide's own tests and nothing else -- the same
    can't-fail-quietly shape as the path mirror, reached a different way.

    Self-references are dropped: `file` defaults to the declaring page, and a
    page is already returned as itself.
    """
    try:
        meta = parse_front_matter(root / page_rel)
    except (OSError, UnicodeDecodeError):
        return set()
    tests = meta.get("test")
    if not isinstance(tests, dict):
        return set()
    tokens = version_path_tokens(page_rel)
    targets: set[str] = set()
    for entries in tests.values():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            source_file = entry.get("file")
            if not source_file:
                continue
            for token, value in tokens.items():
                source_file = source_file.replace(token, value)
            if source_file != page_rel:
                targets.add(source_file)
    return targets


def build_reverse_index(root: pathlib.Path) -> dict[str, set[str]]:
    """``included file -> {files that include it}``, over content/ and assets/.

    Both trees, because a snippet including another snippet is the middle of
    the chain this exists to walk. Indexing only `content/` would find the last
    hop and miss everything above it.

    Inclusion edges ONLY. The `test:` dependencies go in a separate index
    because they are a different relation and must not be chained; see
    `build_test_dependency_index`.
    """
    index: dict[str, set[str]] = {}
    for base in (CONTENT_DIR, ASSETS_DIR):
        for md in (root / base).rglob("*.md"):
            src = md.relative_to(root).as_posix()
            for target in inclusion_targets(md, root):
                index.setdefault(target, set()).add(src)
    return index


def build_test_dependency_index(root: pathlib.Path) -> dict[str, set[str]]:
    """``step source file -> {pages whose tests run it}``.

    Kept apart from the inclusion index because the two relations do NOT
    compose.

    Inclusion is transitive: if a snippet changes, the page that reuses it
    renders different CONTENT, so whatever consumes that page is affected too,
    all the way up.

    A test dependency is not, because it moves no content. If `install/helm.md`
    changes, a test that runs its blocks changes. But the page DECLARING that
    test is unchanged as a document, so a third page whose own test runs
    blocks from the declaring page sees nothing different. Chaining the two
    walks that third page in anyway, and then a fourth.

    ON THE SIZE OF THIS, measured rather than assumed, because the first
    version of this comment asserted a dramatic number that turned out to be
    invented. For a changed SNIPPET it makes no difference at all: the
    inclusion closure already holds the pages, and their dependents are the
    same set either way (`helm-version-flag.md` is 764 pages both ways,
    `namespace.md` 1260 both ways). The difference shows only when the changed
    file is ITSELF a test-step source, where the chained walk adds the
    dependents of its dependents: `install/helm.md` is 24 pages terminal
    against 29 chained.

    So this is a correctness split, not a CI-cost one. 5 spurious pages today,
    and no reason to think the shape stays that small -- the chained answer is
    wrong for a reason that does not depend on how many pages it happens to
    add.

    Applied ONCE, as a terminal step, to the closure of the inclusion walk.
    See `consumers`.
    """
    index: dict[str, set[str]] = {}
    # Front matter only ever lives on a page, so assets/ is skipped rather than
    # parsed and discarded 585 times.
    for md in (root / CONTENT_DIR).rglob("*.md"):
        src = md.relative_to(root).as_posix()
        for target in test_dependency_targets(src, root):
            index.setdefault(target, set()).add(src)
    return index


def consumers(
    changed: list[str],
    index: dict[str, set[str]],
    content_prefix: str = "content/",
    test_index: dict[str, set[str]] | None = None,
) -> list[str]:
    """Every content page whose rendered output or tests depend on ``changed``.

    Two passes, because there are two relations and only one of them chains.

    PASS 1, transitive: walk the inclusion edges up. Breadth-first with a
    `seen` set, which is not just an optimization --
    `agw-docs/snippets/agentgateway.md` is reused by most of the tree, so a
    repeated visit is the normal case rather than a cycle, and without it this
    walks the same subtree thousands of times. The closure is every file whose
    CONTENT is affected, snippets included.

    PASS 2, terminal: any page whose `test:` block runs blocks from a file in
    that closure. Applied once and not followed, because a test dependency
    moves no content; see `build_test_dependency_index` for the measurement of
    what that actually changes (less than it sounds, and for snippets,
    nothing).

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

    if test_index:
        # Over `seen`, not `found`: a test step can name a page OR pull from a
        # snippet in the closure, and restricting to content pages would drop
        # the latter.
        for touched in seen:
            found.update(test_index.get(touched, ()))
    return sorted(found)


DOC_TEST_MARKER = "{{< doc-test"


def carries_doc_tests(path: pathlib.Path) -> bool:
    """Whether this file defines doc tests of its own."""
    try:
        return DOC_TEST_MARKER in path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False


def unresolved(
    changed: list[str],
    index: dict[str, set[str]],
    test_index: dict[str, set[str]] | None = None,
) -> list[str]:
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
    return [c for c in changed if not consumers([c], index, test_index=test_index)]


def unresolved_losing_tests(
    changed: list[str],
    index: dict[str, set[str]],
    root: pathlib.Path,
    test_index: dict[str, set[str]] | None = None,
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
    return [
        c
        for c in unresolved(changed, index, test_index)
        if carries_doc_tests(root / c)
    ]


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
    test_index = build_test_dependency_index(root)
    for page in consumers(changed, index, test_index=test_index):
        print(page)

    # To stderr, so the page list on stdout stays pipeable. A file with tests
    # that selects nothing is the exact symptom of the bug this replaced, and
    # the old code did print it -- as "No content candidates found", buried in
    # a green log nobody opened. Naming it, and only when something is lost,
    # is what makes the difference; the caller decides how loud to be.
    if not args.quiet:
        for path in unresolved_losing_tests(changed, index, root, test_index):
            print(f"has doc tests but reaches no content page: {path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
