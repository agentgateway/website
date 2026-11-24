#!/usr/bin/env python3
"""
Add new trace span attributes to the hand-written attribute reference.

Upstream agentgateway generates schema/tracing.md (`cargo xtask tracing`), which lists every
attribute on the request span, grouped by request kind. The docs page
assets/agw-docs/pages/observability/traces/attribute-reference.md keeps the descriptions, so
it cannot be overwritten. Instead, this script adds a row for each attribute that the page does
not list yet, with an empty description for the writer to fill in on the automated PR.

- Common, LLM, and MCP attributes go at the end of the matching table on the page.
- A2A and Substrate attributes go in their own section, created when first needed.
- New rows are gated so they show only on the in-development version, because the page is
  shared by every version tree.
- Attributes that the page lists but upstream no longer emits are reported, not removed.

Environment:
  LINK_VERSION      "main" or "latest". Only the in-development version is synced.
  DOC_VERSION       Numbered version, such as 1.8.x.
  WEBSITE_DIR       Website checkout (default ".").
  AGENTGATEWAY_DIR  agentgateway checkout that holds schema/tracing.md (default "agentgateway").

Run the tests: python3 -m unittest discover -s scripts -p 'test_*.py'
"""

import os
import re
import sys

PAGE = os.path.join("assets", "agw-docs", "pages", "observability", "traces", "attribute-reference.md")

# The page sections that hold each kind of attribute. A kind without a section gets a new one.
SECTIONS = {
    "Common": "## Conditional attributes",
    "LLM": "## Generative AI attributes (LLM)",
    "MCP": "## MCP attributes",
}
NEW_SECTIONS = {
    "A2A": "## A2A attributes {#a2a-attributes}",
    "Substrate": "## Substrate attributes {#substrate-attributes}",
}
# New sections go before this heading, which documents child spans, not the request span.
CHILD_SPANS_HEADING = "## Policy call child spans"

# Docs hub versions that also reuse this page. They are not in this repo's content tree, so
# they are listed here to keep new rows off them.
HUB_VERSIONS = ("2026.7.1", "2.3.x")

ROW_NAME = re.compile(r"^\|\s*`([^`]+)`")
VERSION_DIR = re.compile(r"^(\d+)\.(\d+)\.x(?:\.zip)?$")


def parse_generated(text: str) -> dict[str, list[tuple[str, str]]]:
    """Return {kind: [(name, condition)]} from schema/tracing.md."""
    groups: dict[str, list[tuple[str, str]]] = {}
    kind = None
    for line in text.splitlines():
        if line.startswith("## "):
            kind = line[3:].strip()
            groups[kind] = []
            continue
        m = ROW_NAME.match(line)
        if m and kind:
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            condition = cells[1] if len(cells) > 1 and cells[1] not in ("—", "-") else ""
            groups[kind].append((m.group(1), condition))
    return groups


def page_names(text: str) -> set[str]:
    """Every name in the first column of any table on the page."""
    return {m.group(1) for line in text.splitlines() if (m := ROW_NAME.match(line))}


def request_span_names(text: str) -> set[str]:
    """Names in the request span tables: skips the child span section and include-if blocks,
    which document older versions."""
    names = set()
    in_child_spans = False
    in_old = False
    in_attribute_table = False
    for line in text.splitlines():
        if line.startswith("## "):
            in_child_spans = line.startswith(CHILD_SPANS_HEADING)
        if "{{% version include-if=" in line:
            in_old = True
        elif "{{% /version %}}" in line:
            in_old = False
        if not line.startswith("|"):
            in_attribute_table = False
            continue
        if line.startswith("| Attribute"):
            in_attribute_table = True
            continue
        if in_child_spans or in_old or not in_attribute_table:
            continue
        m = ROW_NAME.match(line)
        if m:
            names.add(m.group(1))
    return names


def site_versions(website_dir: str) -> list[str]:
    """Numbered versions from hugo.yaml and the content trees, oldest first."""
    found = set()
    for section in ("kubernetes", "standalone"):
        root = os.path.join(website_dir, "content", "docs", section)
        if os.path.isdir(root):
            for entry in os.listdir(root):
                m = VERSION_DIR.match(entry)
                if m:
                    found.add(f"{m.group(1)}.{m.group(2)}.x")
    hugo = os.path.join(website_dir, "hugo.yaml")
    if os.path.isfile(hugo):
        with open(hugo, encoding="utf-8") as f:
            found.update(re.findall(r'^\s*-\s*version:\s*"?(\d+\.\d+\.x)"?', f.read(), re.M))
    return sorted(found, key=lambda v: tuple(int(p) for p in v.split(".")[:2]))


def in_development_version(website_dir: str) -> str:
    """The first entry of params.versions in hugo.yaml, which is the in-development version."""
    with open(os.path.join(website_dir, "hugo.yaml"), encoding="utf-8") as f:
        m = re.search(r'^\s*versions:\s*\n\s*-\s*version:\s*"?([^"\n]+)"?', f.read(), re.M)
    return m.group(1).strip() if m else ""


def exclude_list(website_dir: str, doc_version: str) -> str:
    older = [v for v in site_versions(website_dir) if v != doc_version]
    return ",".join(older + [v for v in HUB_VERSIONS if v not in older])


def _row(name: str, columns: int, condition: str) -> str:
    cells = [f"`{name}`"] + [""] * (columns - 1)
    if columns == 3 and condition:
        cells[1] = condition
    return "| " + " | ".join(cells) + " |"


def _table_end(lines: list[str], heading: int) -> tuple[int, int]:
    """Return (index of the last row, column count) of the first table after a heading."""
    i = heading + 1
    while i < len(lines) and not lines[i].startswith("| Attribute"):
        if lines[i].startswith("## "):
            raise ValueError(f"no table under {lines[heading]!r}")
        i += 1
    if i == len(lines):
        raise ValueError(f"no table under {lines[heading]!r}")
    columns = lines[i].strip().strip("|").count("|") + 1
    while i + 1 < len(lines) and lines[i + 1].startswith("|"):
        i += 1
    return i, columns


def add_rows(text: str, missing: dict[str, list[tuple[str, str]]], excludes: str) -> str:
    """Insert the missing attributes into the page text."""
    lines = text.split("\n")
    open_row = f'{{{{< version exclude-if="{excludes}" >}}}}'
    close_row = "{{< /version >}}"

    for kind, heading in SECTIONS.items():
        rows = missing.get(kind)
        if not rows:
            continue
        index = next((i for i, line in enumerate(lines) if line.startswith(heading)), None)
        if index is None:
            raise ValueError(f"section {heading!r} not found on the page")
        last, columns = _table_end(lines, index)
        new = [_row(name, columns, condition) for name, condition in rows]
        # Open the gate at the end of the previous row, so the table does not break on the
        # trees where the gate renders empty.
        lines[last] += open_row
        new[-1] += close_row
        lines[last + 1 : last + 1] = new

    for kind, heading in NEW_SECTIONS.items():
        rows = missing.get(kind)
        if not rows:
            continue
        index = next((i for i, line in enumerate(lines) if line.startswith(heading.split(" {#")[0])), None)
        if index is not None:
            last, columns = _table_end(lines, index)
            new = [_row(name, columns, condition) for name, condition in rows]
            lines[last + 1 : last + 1] = new
            continue
        block = [
            f'{{{{% version exclude-if="{excludes}" %}}}}',
            heading,
            "",
            "| Attribute | Description |",
            "|-----------|-------------|",
            *[_row(name, 2, condition) for name, condition in rows],
            "{{% /version %}}",
            "",
        ]
        at = next((i for i, line in enumerate(lines) if line.startswith(CHILD_SPANS_HEADING)), len(lines))
        lines[at:at] = block

    return "\n".join(lines)


def sync(website_dir: str, agentgateway_dir: str, doc_version: str) -> bool:
    schema = os.path.join(agentgateway_dir, "schema", "tracing.md")
    if not os.path.isfile(schema):
        print(f"  → No {schema}; this agentgateway ref predates the tracing schema. Skipping.")
        return False
    page = os.path.join(website_dir, PAGE)
    with open(schema, encoding="utf-8") as f:
        generated = parse_generated(f.read())
    with open(page, encoding="utf-8") as f:
        text = f.read()

    documented = page_names(text)
    missing = {
        kind: [(n, c) for n, c in rows if n not in documented]
        for kind, rows in generated.items()
    }
    missing = {k: v for k, v in missing.items() if v}
    unknown = [k for k in missing if k not in SECTIONS and k not in NEW_SECTIONS]
    if unknown:
        raise ValueError(f"no page section for attribute kinds: {', '.join(unknown)}")

    emitted = {n for rows in generated.values() for n, _ in rows}
    stale = sorted(request_span_names(text) - emitted)

    added = sum(len(v) for v in missing.values())
    if added:
        text = add_rows(text, missing, exclude_list(website_dir, doc_version))
        with open(page, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"  ✓ Added {added} attribute(s) to {PAGE}:")
        for kind, rows in missing.items():
            print(f"    {kind}: {', '.join(n for n, _ in rows)}")
    else:
        print(f"  ✓ {PAGE} lists every attribute in {schema}")
    if stale:
        print(f"  ! Listed on the page but not emitted on the request span: {', '.join(stale)}")
    return True


def main() -> None:
    link_version = os.environ.get("LINK_VERSION", "").strip()
    doc_version = os.environ.get("DOC_VERSION", "").strip()
    website_dir = os.environ.get("WEBSITE_DIR", ".")
    agentgateway_dir = os.environ.get("AGENTGATEWAY_DIR", "agentgateway")
    if not doc_version:
        print("Error: DOC_VERSION must be set (e.g. 1.8.x)")
        sys.exit(1)
    current = in_development_version(website_dir)
    if doc_version != current:
        print(f"Skipping trace attributes for {link_version or doc_version}: only the in-development version ({current}) is synced.")
        return
    print(f"Syncing trace attributes for {doc_version} from {agentgateway_dir}")
    sync(website_dir, agentgateway_dir, doc_version)


if __name__ == "__main__":
    main()
