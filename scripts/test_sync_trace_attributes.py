#!/usr/bin/env python3
"""
Tests for sync_trace_attributes.py.

Run: python3 -m unittest discover -s scripts -p 'test_*.py'
"""

import io
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sync_trace_attributes as sync  # noqa: E402

GENERATED = """# Trace span attributes

## Common

| Attribute | Condition |
| --- | --- |
| `gateway` | — |
| `request.id` | Debug logging is enabled for the `request` target. |

## LLM

| Attribute | Condition |
| --- | --- |
| `gen_ai.request.model` | — |
| `gen_ai.request.seed` | — |

## A2A

| Attribute | Condition |
| --- | --- |
| `a2a.method` | — |
"""

PAGE = """## Core HTTP attributes

{{% version include-if="1.0.x" %}}
| Attribute | Description |
|-----------|-------------|
| `http.method` | Old name |
{{% /version %}}

## Conditional attributes

| Attribute | When present | Description |
|-----------|-------------|-------------|
| `gateway` | Always | Gateway name |
| `error` | Proxy errors | Proxy error message |

## Generative AI attributes (LLM)

| Attribute | Description |
|-----------|-------------|
| `gen_ai.request.model` | Requested model |

| Value | Route type |
|-------|------------|
| `chat` | Chat |

## MCP attributes

| Attribute | Description |
|-----------|-------------|
| `mcp.target` | Name of the MCP server |

## Policy call child spans {#policy-child-spans}

| Attribute | Description |
|-----------|-------------|
| `http.host` | Hostname |
"""

HUGO = """params:
  versions:
    - version: "1.8.x"
      linkVersion: "main"
    - version: "1.7.x"
      linkVersion: "latest"
"""

EXCLUDES = "1.0.x,1.7.x,2026.7.1,2.3.x"


class SyncTraceAttributesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.website = os.path.join(self.tmp.name, "website")
        self.agw = os.path.join(self.tmp.name, "agentgateway")
        os.makedirs(os.path.join(self.website, os.path.dirname(sync.PAGE)))
        os.makedirs(os.path.join(self.website, "content", "docs", "kubernetes", "1.0.x"))
        os.makedirs(os.path.join(self.agw, "schema"))
        self._write(os.path.join(self.website, sync.PAGE), PAGE)
        self._write(os.path.join(self.website, "hugo.yaml"), HUGO)
        self._write(os.path.join(self.agw, "schema", "tracing.md"), GENERATED)

    def tearDown(self):
        self.tmp.cleanup()

    @staticmethod
    def _write(path, text):
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

    def _page(self):
        with open(os.path.join(self.website, sync.PAGE), encoding="utf-8") as f:
            return f.read()

    def _run(self):
        out = io.StringIO()
        with redirect_stdout(out):
            sync.sync(self.website, self.agw, "1.8.x")
        return out.getvalue()

    def test_exclude_list_has_every_other_version_and_hub_versions(self):
        self.assertEqual(sync.exclude_list(self.website, "1.8.x"), EXCLUDES)

    def test_in_development_version_is_first_entry(self):
        self.assertEqual(sync.in_development_version(self.website), "1.8.x")

    def test_adds_missing_rows_with_gate_opened_on_previous_row(self):
        self._run()
        page = self._page()
        gate = f'{{{{< version exclude-if="{EXCLUDES}" >}}}}'
        self.assertIn(f"| `error` | Proxy errors | Proxy error message |{gate}\n", page)
        self.assertIn("| `request.id` | Debug logging is enabled for the `request` target. |  |{{< /version >}}", page)
        self.assertIn(f"| `gen_ai.request.model` | Requested model |{gate}\n| `gen_ai.request.seed` |  |{{{{< /version >}}}}", page)
        # Documented names are not added again.
        self.assertEqual(page.count("`gateway`"), 1)

    def test_new_kind_gets_gated_section_before_child_spans(self):
        self._run()
        page = self._page()
        section = page.index("## A2A attributes {#a2a-attributes}")
        self.assertLess(section, page.index("## Policy call child spans"))
        self.assertIn(f'{{{{% version exclude-if="{EXCLUDES}" %}}}}\n## A2A attributes', page)
        self.assertIn("| `a2a.method` |  |\n{{% /version %}}", page)

    def test_second_run_changes_nothing(self):
        self._run()
        first = self._page()
        out = self._run()
        self.assertEqual(self._page(), first)
        self.assertIn("lists every attribute", out)

    def test_reports_stale_names_only_from_request_span_attribute_tables(self):
        out = self._run()
        stale = next(line for line in out.splitlines() if "not emitted" in line)
        self.assertIn("error", stale)
        self.assertIn("mcp.target", stale)
        for ignored in ("http.method", "http.host", "chat"):
            self.assertNotIn(ignored, stale)

    def test_missing_schema_is_skipped(self):
        os.remove(os.path.join(self.agw, "schema", "tracing.md"))
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertFalse(sync.sync(self.website, self.agw, "1.8.x"))
        self.assertEqual(self._page(), PAGE)


if __name__ == "__main__":
    unittest.main()
