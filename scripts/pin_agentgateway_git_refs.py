#!/usr/bin/env python3
"""
Pin agentgateway main-branch URLs in a released docs tree to its release tag.

WHY

The main docs tree links to, downloads from, and fetches at build time files on the
agentgateway main branch: example configs, schema tables, dashboards. That is right
while the tree describes main. When a release copies main to latest, the same URLs
keep following main, so the released docs show whatever main holds next week. Pin
them to the release tag in the new latest tree at release time. The next release
freezes that tree with the pins already in place, so frozen trees need nothing.

WHAT IT REWRITES

  raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/P -> .../refs/tags/<tag>/P
  raw.githubusercontent.com/agentgateway/agentgateway/main/P            -> .../<tag>/P
  github.com/agentgateway/agentgateway/(blob|tree|raw)/main/P           -> .../<kind>/<tag>/P
  agentgateway.dev/examples/P   (static/_redirects sends it to main)   -> raw.githubusercontent.com/agentgateway/agentgateway/<tag>/examples/P

Each path is rewritten only when it exists at the tag, which the script checks with
`gh api`. Paths that do not exist at the tag stay on main and are listed, so a file
added to main after the release is never pinned to a 404.

Only the trees you pass are changed. Shared files under assets/agw-docs serve every
version, so they cannot carry one version's tag and are left alone.

Usage:
  python3 scripts/pin_agentgateway_git_refs.py --tag v1.7.0 \\
      content/docs/kubernetes/latest content/docs/standalone/latest
  python3 scripts/pin_agentgateway_git_refs.py --tag v1.7.0 --dry-run content/docs/standalone/latest
"""

import argparse
import re
import subprocess
import sys

URL = re.compile(
    r"https://(?P<host>raw\.githubusercontent\.com/agentgateway/agentgateway/(?P<rawref>refs/heads/main|main)/"
    r"|github\.com/agentgateway/agentgateway/(?P<kind>blob|tree|raw)/main/"
    r"|agentgateway\.dev/examples/)(?P<path>[^\s\"')>\]`#]*)"
)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--tag", required=True, help="agentgateway release tag, such as v1.7.0")
    ap.add_argument("--dry-run", action="store_true", help="report without writing files")
    ap.add_argument("trees", nargs="+", help="content trees to pin, such as content/docs/standalone/latest")
    args = ap.parse_args()
    tag = args.tag
    seen = {}

    def exists(path):
        if path not in seen:
            r = subprocess.run(
                ["gh", "api", f"repos/agentgateway/agentgateway/contents/{path.rstrip('/')}?ref={tag}",
                 "--jq", "type"],
                capture_output=True, text=True)
            seen[path] = r.returncode == 0
        return seen[path]

    def target(m):
        path, host = m.group("path"), m.group("host")
        if host.startswith("agentgateway.dev/examples/"):
            return "examples/" + path, f"https://raw.githubusercontent.com/agentgateway/agentgateway/{tag}/examples/{path}"
        if host.startswith("raw."):
            ref = f"refs/tags/{tag}" if m.group("rawref") == "refs/heads/main" else tag
            return path, f"https://raw.githubusercontent.com/agentgateway/agentgateway/{ref}/{path}"
        return path, f"https://github.com/agentgateway/agentgateway/{m.group('kind')}/{tag}/{path}"

    total_pinned, unpinned = 0, set()
    for tree in args.trees:
        files = subprocess.run(["git", "ls-files", tree], capture_output=True, text=True, check=True).stdout.split()
        pinned, changed = 0, 0
        for f in files:
            if not f.endswith(".md"):
                continue
            with open(f, encoding="utf-8") as fh:
                text = fh.read()

            def sub(m):
                nonlocal pinned
                path, new = target(m)
                if not path or not exists(path):
                    unpinned.add(m.group(0))
                    return m.group(0)
                pinned += 1
                return new

            new_text = URL.sub(sub, text)
            if new_text != text:
                changed += 1
                if not args.dry_run:
                    with open(f, "w", encoding="utf-8") as fh:
                        fh.write(new_text)
        total_pinned += pinned
        print(f"{tree}: pinned {pinned} URLs in {changed} files to {tag}" + (" (dry run)" if args.dry_run else ""))

    for u in sorted(unpinned):
        print(f"  not at {tag}, left on main: {u}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
