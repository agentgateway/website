#!/usr/bin/env python3
"""
Tests for fix_cross_file_metric_prefixes in generate-ref-docs.py.

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

CONSTS = 'package setup\n\nconst (\n\txdsSubsystem = "xds"\n\tgatewayLabel = "gateway"\n)\n'

METRICS = (
    "package setup\n\n"
    "var rotations = metrics.NewCounter(\n"
    "\tmetrics.CounterOpts{\n"
    "\t\tSubsystem: xdsSubsystem,\n"
    '\t\tName:      "cert_rotation_total",\n'
    '\t\tHelp:      "Total number of successful xDS certificate rotations",\n'
    '\t}, []string{gatewayLabel, "result"})\n\n'
    "var local = metrics.NewGauge(\n"
    "\tmetrics.GaugeOpts{\n"
    '\t\tName: "local_total",\n'
    '\t\tHelp: "Already correct",\n'
    '\t}, []string{"gateway"})\n'
)

HEADER = "Name|Type|Labels|Help\n--|--|--|--\n"


class FixCrossFileMetricPrefixesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        pkg = os.path.join(self.tmp.name, "pkg", "setup")
        os.makedirs(pkg)
        with open(os.path.join(pkg, "controlplane.go"), "w") as f:
            f.write(CONSTS)
        with open(os.path.join(pkg, "xds_tls.go"), "w") as f:
            f.write(METRICS)

    def tearDown(self):
        self.tmp.cleanup()

    def fix(self, table):
        with redirect_stdout(io.StringIO()) as out:
            result = gen.fix_cross_file_metric_prefixes(table, self.tmp.name)
        return result, out.getvalue()

    def test_renames_metric_and_resolves_labels(self):
        table = (
            HEADER
            + "agentgateway_cert_rotation_total|counter|gatewayLabel, result|Total number of successful xDS certificate rotations\n"
            + "agentgateway_local_total|gauge|gateway|Already correct\n"
        )
        result, _ = self.fix(table)
        self.assertEqual(
            result,
            HEADER
            + "agentgateway_local_total|gauge|gateway|Already correct\n"
            + "agentgateway_xds_cert_rotation_total|counter|gateway, result|Total number of successful xDS certificate rotations\n",
        )

    def test_warns_when_row_is_missing(self):
        result, out = self.fix(HEADER)
        self.assertEqual(result, HEADER)
        self.assertIn("no row for agentgateway_cert_rotation_total", out)


if __name__ == "__main__":
    unittest.main()
