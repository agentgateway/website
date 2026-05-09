#!/usr/bin/env python3
"""
Generate agctl CLI reference docs for the agentgateway website.

Reads LINK_VERSION from the environment (values: "latest" or "main") and produces
one Markdown file per agctl command into:

  assets/agw-docs/pages/reference/agctl/{link_version}/

The script writes a small Go program into the cloned agentgateway repo that
imports the agctl CLI package and runs cobra's doc.GenMarkdownTree, then
rewrites the generated files with Hugo frontmatter and fixes the cross-links.

Usage (from workflow):
  LINK_VERSION=main \\
  KGATEWAY_DIR=/path/to/agentgateway \\
  WEBSITE_DIR=/path/to/website \\
  python3 scripts/generate-agctl-ref.py
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# Cobra writes one file per command. The root command becomes "agctl.md", and
# each subcommand uses underscores: "agctl_trace.md", "agctl_config_all.md".
GO_DOC_GEN = '''package main

import (
\t"fmt"
\t"os"

\t"github.com/spf13/cobra/doc"

\t"github.com/agentgateway/agentgateway/controller/pkg/cli"
)

func main() {
\tif len(os.Args) < 2 {
\t\tfmt.Fprintln(os.Stderr, "usage: gen-agctl-docs <out-dir>")
\t\tos.Exit(1)
\t}
\tcmd := cli.NewRootCmd()
\tcmd.DisableAutoGenTag = true
\tif err := doc.GenMarkdownTree(cmd, os.Args[1]); err != nil {
\t\tfmt.Fprintln(os.Stderr, err)
\t\tos.Exit(1)
\t}
}
'''

GO_MOD_TEMPLATE = '''module gen-agctl-docs

go 1.25

require (
\tgithub.com/agentgateway/agentgateway v0.0.0-00010101000000-000000000000
\tgithub.com/spf13/cobra v1.10.2
)

replace github.com/agentgateway/agentgateway => {agentgateway_path}
'''


def slug_for_filename(filename: str) -> str:
    """Map "agctl_config_all.md" -> "agctl-config-all" for the URL slug."""
    return Path(filename).stem.replace("_", "-")


def title_for_filename(filename: str) -> str:
    """Map "agctl_config_all.md" -> "agctl config all"."""
    return Path(filename).stem.replace("_", " ")


def weight_for_filename(filename: str) -> int:
    """Order: agctl.md first (10), then by depth and name."""
    stem = Path(filename).stem
    if stem == "agctl":
        return 10
    parts = stem.split("_")
    return 10 + len(parts) * 10 + sum(ord(c) for c in stem) % 100


def rewrite_file(path: Path) -> None:
    """Add Hugo frontmatter and fix relative cross-links."""
    text = path.read_text(encoding="utf-8")

    # Cobra writes "## agctl trace\n\n<short>\n\n### Synopsis\n\n..."
    # Strip the leading "## " heading so Hugo renders our title from frontmatter.
    text = re.sub(r"^## .+?\n+", "", text, count=1)

    # Rewrite relative .md links so they resolve under reference/agctl/.
    # Cobra emits links like [agctl trace](agctl_trace.md). Convert to
    # ../<slug>/ which works under Hugo's section page layout.
    def link_sub(match: re.Match) -> str:
        label = match.group(1)
        target = match.group(2)
        slug = slug_for_filename(target)
        return f"[{label}](../{slug}/)"

    text = re.sub(r"\[([^\]]+)\]\(([a-zA-Z0-9_]+\.md)\)", link_sub, text)

    title = title_for_filename(path.name)
    weight = weight_for_filename(path.name)
    description = f"Reference for the `{title}` command."

    frontmatter = (
        "---\n"
        f"title: {title}\n"
        f"weight: {weight}\n"
        f"description: {description}\n"
        "test: skip\n"
        "---\n\n"
    )

    path.write_text(frontmatter + text.lstrip(), encoding="utf-8")


CONTENT_MODES = ("standalone", "kubernetes")


def write_wrapper_pages(website_dir: str, link_version: str, generated: list[Path]) -> None:
    """Create thin wrapper pages under content/docs/<mode>/<link_version>/reference/agctl/.

    Each wrapper just pulls in the matching generated reuse asset, so adding a
    new agctl subcommand is a no-touch change for the wrapper layer.
    """
    for mode in CONTENT_MODES:
        wrapper_dir = Path(website_dir) / "content" / "docs" / mode / link_version / "reference" / "agctl"
        wrapper_dir.mkdir(parents=True, exist_ok=True)

        # Wipe stale wrappers (except _index.md) so removed commands do not linger.
        for stale in wrapper_dir.glob("*.md"):
            if stale.name == "_index.md":
                continue
            stale.unlink()

        for asset in generated:
            slug = asset.stem  # e.g. "agctl-config-all"
            title = slug.replace("-", " ")
            weight = weight_for_filename(asset.name)
            wrapper = wrapper_dir / asset.name
            wrapper.write_text(
                "---\n"
                f"title: {title}\n"
                f"weight: {weight}\n"
                f"description: Reference for the `{title}` command.\n"
                "test: skip\n"
                "---\n\n"
                f'{{{{< reuse "agw-docs/pages/reference/agctl/{link_version}/{slug}.md" >}}}}\n',
                encoding="utf-8",
            )


def generate(link_version: str, website_dir: str, kgateway_dir: str) -> bool:
    print(f"  → Generating agctl CLI docs for {link_version}")

    out_dir = Path(website_dir) / "assets" / "agw-docs" / "pages" / "reference" / "agctl" / link_version
    out_dir.mkdir(parents=True, exist_ok=True)

    # Wipe stale files so removed commands do not linger.
    for stale in out_dir.glob("*.md"):
        stale.unlink()

    # Locate the agentgateway Go module so the generator can resolve the cli
    # package via a replace directive. go.mod sits at the repo root today, but
    # tolerate a controller/ layout too.
    candidates = [Path(kgateway_dir), Path(kgateway_dir) / "controller"]
    module_dir = next((c for c in candidates if (c / "go.mod").exists()), None)
    if module_dir is None:
        print(f"    Error: go.mod not found under {kgateway_dir}")
        return False

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        gen_dir = tmp_path / "gen-agctl-docs"
        gen_dir.mkdir()
        (gen_dir / "main.go").write_text(GO_DOC_GEN, encoding="utf-8")
        (gen_dir / "go.mod").write_text(
            GO_MOD_TEMPLATE.format(agentgateway_path=module_dir.resolve()),
            encoding="utf-8",
        )

        raw_out = tmp_path / "raw"
        raw_out.mkdir()

        try:
            # Resolve dependencies (cobra/doc + transitive go-md2man) into the
            # generator's own go.sum before running.
            subprocess.run(
                ["go", "mod", "tidy"],
                check=True,
                cwd=gen_dir,
            )
            subprocess.run(
                ["go", "run", ".", str(raw_out)],
                check=True,
                cwd=gen_dir,
            )
        except subprocess.CalledProcessError as e:
            print(f"    Error: doc generator failed: {e}")
            return False

        generated: list[Path] = []
        for src in sorted(raw_out.glob("*.md")):
            dest_slug = slug_for_filename(src.name)
            dest = out_dir / f"{dest_slug}.md"
            shutil.copyfile(src, dest)
            rewrite_file(dest)
            generated.append(dest)
            print(f"    ✓ Wrote {dest.relative_to(website_dir)}")

    write_wrapper_pages(website_dir, link_version, generated)
    return True


def main() -> None:
    link_version = os.environ.get("LINK_VERSION", "").strip()
    if not link_version:
        print("Error: LINK_VERSION must be set (e.g. latest, main)")
        sys.exit(1)

    website_dir = os.environ.get("WEBSITE_DIR", ".")
    kgateway_dir = os.environ.get("KGATEWAY_DIR", "agentgateway")

    if not os.path.isdir(kgateway_dir):
        print(f"Error: agentgateway directory not found at {kgateway_dir}")
        sys.exit(1)

    if not generate(link_version, website_dir, kgateway_dir):
        sys.exit(1)


if __name__ == "__main__":
    main()
