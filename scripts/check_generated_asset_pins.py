#!/usr/bin/env python3
"""
Fail when a versioned docs page reuses a MOVING generated reference asset.

WHAT IS A MOVING ASSET

scripts/generate-ref-docs.py writes each generated artifact twice: once under the
link version ("main", "latest") and once under the numbered doc version ("1.6.x").

  assets/agw-docs/pages/reference/helm/{main,latest}/     <- MOVING, rewritten every run
  assets/agw-docs/pages/reference/helm/1.6.x/             <- FROZEN snapshot of one release
  assets/agw-docs/snippets/metrics-control-plane-{main,latest}.md   <- MOVING
  assets/agw-docs/snippets/metrics-control-plane-1.6.x.md           <- FROZEN

The content behind "main" and "latest" changes at every release. A page under
content/docs/<section>/main/ SHOULD reuse the "main" copy, because that page also
tracks the development branch. An ARCHIVED page must not: it is pinned to a release
that no longer moves, so it needs the frozen numbered snapshot instead.

THE RULE

A page may reuse a moving asset only when the moving token matches its own version
directory. Everything else is a violation:

  content/docs/kubernetes/main/...   reusing helm/main/     OK
  content/docs/kubernetes/latest/... reusing helm/latest/   OK
  content/docs/kubernetes/1.4.x/...  reusing helm/main/     VIOLATION (shows dev values)
  content/docs/kubernetes/1.0.x/...  reusing helm/latest/   VIOLATION (shows 1.5 values)
  content/docs/kubernetes/main/...   reusing helm/latest/   VIOLATION (mismatched pin)

WHY THIS EXISTS

Archiving a version means pointing its stub at the frozen snapshot. That step is
easy to skip, and skipping it is invisible: the page still builds and still renders
a plausible table, just of the wrong release. It has already been skipped once --
metrics-control-plane-22x.md was frozen by hand while the matching helm/2.2.x
snapshot never was. This check turns that silent wrong page into a failed run.

BASELINE

Versions archived before snapshots existed have no frozen directory to point at, so
they are listed below and reported as known. Generating their assets means running
generate-ref-docs.py against each old tag. As that happens, delete entries here; the
check fails if a baselined path stops violating, so the list cannot rot.

Usage:
  python3 scripts/check_generated_asset_pins.py [--content-dir content/docs]
"""

import argparse
import os
import re
import sys

# Link versions whose generated assets are rewritten on every workflow run.
MOVING_TOKENS = ("main", "latest")

# Repo-relative pages that violate the rule today, each because the version was
# archived before generate-ref-docs.py wrote numbered snapshots. Remove an entry
# once its version has a frozen snapshot and its stub points at it.
BASELINE = frozenset(
    {
        "content/docs/kubernetes/1.0.x/reference/helm/agentgateway-crds.md",
        "content/docs/kubernetes/1.0.x/reference/helm/agentgateway.md",
        "content/docs/kubernetes/1.1.x/reference/helm/agentgateway-crds.md",
        "content/docs/kubernetes/1.1.x/reference/helm/agentgateway.md",
        "content/docs/kubernetes/1.2.x/reference/helm/agentgateway-crds.md",
        "content/docs/kubernetes/1.2.x/reference/helm/agentgateway.md",
        "content/docs/kubernetes/1.3.x/reference/helm/agentgateway-crds.md",
        "content/docs/kubernetes/1.3.x/reference/helm/agentgateway.md",
        "content/docs/kubernetes/1.4.x/reference/helm/agentgateway-crds.md",
        "content/docs/kubernetes/1.4.x/reference/helm/agentgateway.md",
    }
)

REFERENCE_PATTERNS = (
    # assets/agw-docs/pages/reference/helm/<token>/
    re.compile(r"reference/helm/(?P<token>[A-Za-z0-9.]+)/"),
    # assets/agw-docs/snippets/metrics-control-plane-<token>.md
    re.compile(r"metrics-control-plane-(?P<token>[A-Za-z0-9.]+)\.md"),
)


def page_version(rel_path: str, content_dir: str) -> str:
    """Return the version directory segment of a page, or "" if it has none.

    content/docs/<section>/<version>/... -> <version>
    """
    rel = os.path.relpath(rel_path, content_dir)
    parts = rel.split(os.sep)
    if len(parts) < 2:
        return ""
    return parts[1]


def find_violations(content_dir: str, repo_root: str):
    """Yield (repo_relative_path, token, page_version) for each bad reuse."""
    for dirpath, _dirnames, filenames in os.walk(content_dir):
        for name in sorted(filenames):
            if not name.endswith(".md"):
                continue
            path = os.path.join(dirpath, name)
            version = page_version(path, content_dir)
            if not version:
                continue
            try:
                with open(path, encoding="utf-8") as handle:
                    text = handle.read()
            except (OSError, UnicodeDecodeError) as exc:
                print(f"Warning: cannot read {path}: {exc}", file=sys.stderr)
                continue

            for pattern in REFERENCE_PATTERNS:
                for match in pattern.finditer(text):
                    token = match.group("token")
                    if token not in MOVING_TOKENS:
                        continue  # already pinned to a frozen snapshot
                    if token == version:
                        continue  # the page tracks the same moving version
                    yield os.path.relpath(path, repo_root), token, version


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--content-dir", default="content/docs", help="Root of the versioned content tree.")
    parser.add_argument("--repo-root", default=".", help="Repo root that reported paths are relative to.")
    args = parser.parse_args()

    if not os.path.isdir(args.content_dir):
        print(f"Error: content directory not found: {args.content_dir}", file=sys.stderr)
        return 2

    violations = sorted(set(find_violations(args.content_dir, args.repo_root)))
    seen_paths = {path for path, _token, _version in violations}

    new = [v for v in violations if v[0] not in BASELINE]
    fixed = sorted(BASELINE - seen_paths)

    for path, token, version in violations:
        label = "known" if path in BASELINE else "NEW"
        print(f"  [{label}] {path}: version {version!r} reuses the moving {token!r} asset")

    status = 0

    if new:
        print(
            f"\nFAIL: {len(new)} page(s) pin a moving generated asset.\n"
            "An archived version must reuse its frozen numbered snapshot, not 'main' or 'latest',\n"
            "or it will render the values of whatever release that pointer currently tracks.\n"
            "Point the stub at assets/agw-docs/pages/reference/helm/<version>/ instead.",
            file=sys.stderr,
        )
        status = 1

    if fixed:
        print(
            "\nFAIL: these paths are in BASELINE but no longer violate the rule.\n"
            "Delete them from BASELINE in scripts/check_generated_asset_pins.py so the\n"
            "baseline cannot silently grow stale:\n  " + "\n  ".join(fixed),
            file=sys.stderr,
        )
        status = 1

    if status == 0:
        known = len(violations)
        print(f"\nOK: no new moving-asset pins ({known} known, awaiting backfill).")

    return status


if __name__ == "__main__":
    sys.exit(main())
