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

# A reuse target is written relative to `assets/`, uniformly: every one of the
# 9,405 in the tree today starts `agw-docs/`. Resolved from that single base
# rather than probed, because a target that does not resolve is a broken
# shortcode and should look like one.
ASSETS_DIR = "assets"


def reuse_targets(path: pathlib.Path) -> set[str]:
    """The assets-relative paths this file pulls in directly."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return set()
    return {f"{ASSETS_DIR}/{m}" for m in REUSE_RE.findall(text)}


def build_reverse_index(root: pathlib.Path) -> dict[str, set[str]]:
    """``included file -> {files that include it}``, over content/ and assets/.

    Both trees, because a snippet including another snippet is the middle of
    the chain this exists to walk. Indexing only `content/` would find the last
    hop and miss everything above it.
    """
    index: dict[str, set[str]] = {}
    for base in ("content", ASSETS_DIR):
        for md in (root / base).rglob("*.md"):
            src = md.relative_to(root).as_posix()
            for target in reuse_targets(md):
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

    for page in consumers(changed, build_reverse_index(root)):
        print(page)
    return 0


if __name__ == "__main__":
    sys.exit(main())
