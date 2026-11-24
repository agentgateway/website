#!/usr/bin/env python3
"""
Tests for parse_data_plane_metrics and generate_data_plane_metrics_docs in generate-ref-docs.py.

Run: python3 -m unittest discover -s scripts -p 'test_*.py'
"""

import importlib.util
import io
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout

_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _SCRIPTS)

_SPEC = importlib.util.spec_from_file_location("generate_ref_docs", os.path.join(_SCRIPTS, "generate-ref-docs.py"))
gen = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(gen)

SCHEMA = """# Metrics

## XDS

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_xds_message_total` | Counter | — | Total number of messages received (unstable). |

## HTTP

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_requests_active` | Gauge | — | Number of HTTP requests currently awaiting a response. |
"""


class ParseTest(unittest.TestCase):
    def test_drops_title_and_blank_lines_keeps_sections(self):
        out = gen.parse_data_plane_metrics(SCHEMA)
        self.assertFalse(out.startswith("# Metrics"))
        self.assertTrue(out.startswith("### XDS\n"))
        self.assertIn("### HTTP\n", out)
        self.assertEqual(out.count("| Metric | Type | Unit | Description |"), 2)
        self.assertNotIn("\n\n", out)
        self.assertTrue(out.endswith("\n"))

    def test_drops_prose_with_a_warning(self):
        text = SCHEMA.replace("## HTTP\n", "## HTTP\n\nSome intro paragraph.\n")
        buf = io.StringIO()
        with redirect_stdout(buf):
            out = gen.parse_data_plane_metrics(text)
        self.assertNotIn("Some intro paragraph", out)
        self.assertIn("Warning: dropped non-table line", buf.getvalue())
        self.assertIn("Some intro paragraph", buf.getvalue())

    def test_empty_when_no_rows(self):
        self.assertEqual(gen.parse_data_plane_metrics("# Metrics\n\nnothing\n"), "")


class GenerateTest(unittest.TestCase):
    def _run(self, schema, doc_version=""):
        with tempfile.TemporaryDirectory() as root:
            agw = os.path.join(root, "agentgateway")
            site = os.path.join(root, "website")
            os.makedirs(os.path.join(agw, "schema" if schema is not None else "controller"))
            if schema is not None:
                with open(os.path.join(agw, "schema", "metrics.md"), "w") as f:
                    f.write(schema)
            with redirect_stdout(io.StringIO()):
                ok = gen.generate_data_plane_metrics_docs("main", site, agw, doc_version)
            snippets = os.path.join(site, "assets", "agw-docs", "snippets")
            files = sorted(os.listdir(snippets)) if os.path.isdir(snippets) else []
            return ok, files

    def test_writes_link_and_frozen_names(self):
        ok, files = self._run(SCHEMA, "1.8.x")
        self.assertTrue(ok)
        self.assertEqual(files, ["metrics-data-plane-1.8.x.md", "metrics-data-plane-main.md"])

    def test_skips_cleanly_when_schema_absent(self):
        ok, files = self._run(None, "1.4.x")
        self.assertFalse(ok)
        self.assertEqual(files, [])


if __name__ == "__main__":
    unittest.main()
