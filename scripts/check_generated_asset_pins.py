#!/usr/bin/env python3
"""
Fail when a versioned docs page reuses the wrong generated reference asset.

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

A page may reuse a generated asset only when the asset's version token equals the
page's own version directory, and only when that asset exists on disk. Three ways
to break it:

  moving    content/docs/kubernetes/1.4.x/... reusing helm/main/     (shows dev values)
            content/docs/kubernetes/1.0.x/... reusing helm/latest/   (shows 1.5 values)
            content/docs/kubernetes/main/...  reusing helm/latest/   (mismatched pin)
  mismatch  content/docs/kubernetes/1.6.x/... reusing helm/1.4.x/    (shows 1.4 values)
  missing   content/docs/kubernetes/1.5.x/... reusing helm/1.5.x/    when that
            directory has not been generated yet

The "missing" case is the one that bites during a version rotation. Repointing a
stub is a one-line edit that looks correct in review, and the snapshot it points at
only exists once reference-docs.yaml has run for that doc version.

WHY THIS EXISTS

Archiving a version means pointing its stub at the frozen snapshot. That step is
easy to skip, and skipping it is invisible: the page still builds and still renders
a plausible table, just of the wrong release. Ten pages are in that state today.
content/docs/kubernetes/1.0.x through 1.4.x reuse .../helm/main/ or .../helm/latest/,
and hugo.yaml sets no ignoreFiles, so those directories build and publish. Every one
of them serves a values table for a release the reader did not ask for.

2.2.x shows the step is doable: assets/agw-docs/pages/reference/helm/2.2.x/ exists
and both 2.2.x stubs reuse it. It also shows why a checklist is not enough, since
the same care was not applied to the five versions archived around it.

BASELINE

Versions archived before snapshots existed have no frozen directory to point at, so
they are listed below and reported as known. Generating their assets means running
generate-ref-docs.py against each old tag. As that happens, delete entries here; the
check fails if a baselined path stops violating, so the list cannot rot.

The baseline exempts the "moving" case only. A baselined page still fails if it
gains a mismatch or points at an asset that is not there.

Usage:
  python3 scripts/check_generated_asset_pins.py [--content-dir content/docs] [--assets-dir assets]
"""

import argparse
import os
import re
import sys

# Link versions whose generated assets are rewritten on every workflow run.
MOVING_TOKENS = ("main", "latest")

# Version directory names this check understands: the two moving pointers, plus the
# numbered form used by hugo.yaml params.versions and by the frozen snapshots.
NUMBERED_VERSION = re.compile(r"^\d+\.\d+\.x$")

# Repo-relative pages that reuse a moving asset today, each because the version was
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

# Any reuse shortcode, in either the angle or the percent form.
REUSE_SHORTCODE = re.compile(r"\{\{[<%]-?\s*reuse\s+\"(?P<path>[^\"]+)\"")

# The subset of reuse targets that generate-ref-docs.py produces. A reuse path that
# matches none of these is some other snippet and is left alone.
GENERATED_ASSETS = (
    # agw-docs/pages/reference/helm/<token>/<chart>.md
    re.compile(r"^agw-docs/pages/reference/helm/(?P<token>[^/]+)/[^/]+\.md$"),
    # agw-docs/snippets/metrics-control-plane-<token>.md
    re.compile(r"^agw-docs/snippets/metrics-control-plane-(?P<token>.+)\.md$"),
)


def page_version(path: str, content_dir: str) -> str:
    """Return the version directory segment of a page, or "" if it has none.

    content/docs/<section>/<version>/... -> <version>

    Only a recognized version name counts, so a file that sits directly in a section
    root (content/docs/kubernetes/_index.md) is reported as unversioned rather than
    treated as if "_index.md" were a version.
    """
    rel = os.path.relpath(path, content_dir)
    parts = rel.split(os.sep)
    if len(parts) < 3:
        return ""
    candidate = parts[1]
    if candidate in MOVING_TOKENS or NUMBERED_VERSION.match(candidate):
        return candidate
    return ""


def classify(token: str, version: str, asset_path: str, assets_dir: str) -> str:
    """Return the violation kind for one reuse, or "" when the reuse is correct.

    A missing asset is reported ahead of a version mismatch: if the file is not
    there, which version it claims to hold is the smaller problem.
    """
    if not os.path.isfile(os.path.join(assets_dir, asset_path)):
        return "missing"
    if token == version:
        return ""
    if token in MOVING_TOKENS:
        return "moving"
    return "mismatch"


def find_violations(content_dir: str, assets_dir: str, repo_root: str):
    """Yield (repo_relative_path, kind, token, page_version, asset_path) per bad reuse."""
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

            for reuse in REUSE_SHORTCODE.finditer(text):
                asset_path = reuse.group("path")
                for pattern in GENERATED_ASSETS:
                    match = pattern.match(asset_path)
                    if not match:
                        continue
                    token = match.group("token")
                    kind = classify(token, version, asset_path, assets_dir)
                    if kind:
                        yield os.path.relpath(path, repo_root), kind, token, version, asset_path
                    break


EXPLANATION = {
    "moving": (
        "reuses a moving 'main' or 'latest' asset, so it renders the values of whatever\n"
        "release that pointer currently tracks rather than its own."
    ),
    "mismatch": (
        "reuses a frozen snapshot of a different version, so it renders that release's\n"
        "values rather than its own."
    ),
    "missing": (
        "reuses an asset that does not exist. Generate it by running reference-docs.yaml\n"
        "for that doc version, or point the stub at a snapshot that is already there."
    ),
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--content-dir", default="content/docs", help="Root of the versioned content tree.")
    parser.add_argument("--assets-dir", default="assets", help="Root that reuse paths resolve against.")
    parser.add_argument("--repo-root", default=".", help="Repo root that reported paths are relative to.")
    args = parser.parse_args()

    for label, path in (("content", args.content_dir), ("assets", args.assets_dir)):
        if not os.path.isdir(path):
            print(f"Error: {label} directory not found: {path}", file=sys.stderr)
            return 2

    violations = sorted(set(find_violations(args.content_dir, args.assets_dir, args.repo_root)))

    # The baseline forgives the moving-asset case only, so the anti-rot comparison is
    # against moving violations alone. A baselined page that starts pointing at a
    # missing or mismatched asset still fails.
    moving_paths = {path for path, kind, _t, _v, _a in violations if kind == "moving"}

    new = [v for v in violations if not (v[1] == "moving" and v[0] in BASELINE)]
    fixed = sorted(BASELINE - moving_paths)

    for path, kind, token, version, asset_path in violations:
        known = kind == "moving" and path in BASELINE
        label = "known" if known else "NEW"
        print(f"  [{label}] {kind}: {path} (version {version!r}) -> {asset_path} (token {token!r})")

    # The failure summaries below go to stderr, which is unbuffered while a piped
    # stdout is not. Without this the CI log prints the summaries before the list
    # of violations they summarize.
    sys.stdout.flush()

    status = 0

    if new:
        kinds = sorted({v[1] for v in new})
        print(
            f"\nFAIL: {len(new)} bad reuse(s) of a generated reference asset.\n"
            + "\n".join(f"\n{kind}: a page {EXPLANATION[kind]}" for kind in kinds),
            file=sys.stderr,
        )
        status = 1

    if fixed:
        print(
            "\nFAIL: these paths are in BASELINE but no longer reuse a moving asset.\n"
            "Delete them from BASELINE in scripts/check_generated_asset_pins.py so the\n"
            "baseline cannot silently grow stale. A page that was deleted or renamed\n"
            "needs its old path removed here too:\n  " + "\n  ".join(fixed),
            file=sys.stderr,
        )
        status = 1

    if status == 0:
        print(f"\nOK: no bad generated-asset reuses ({len(violations)} known, awaiting backfill).")

    return status


if __name__ == "__main__":
    sys.exit(main())
