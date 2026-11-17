#!/usr/bin/env python3
"""
Tests for local-version-config.py's --only-changed tree selection.

Run: python3 -m unittest discover -s scripts -p 'test_*.py'

Stdlib unittest only, matching the rest of scripts/.
"""

import importlib.util
import os
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    "local_version_config", os.path.join(_HERE, "local-version-config.py")
)
lvc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lvc)

# Mirrors hugo.yaml's params.versions shape.
ENTRIES = [
    {"version": "1.8.x", "linkVersion": "main", "sections": ["kubernetes", "standalone"]},
    {"version": "1.7.x", "linkVersion": "latest", "sections": ["kubernetes", "standalone"]},
]
BUILT = ["kubernetes/latest", "kubernetes/main", "standalone/latest", "standalone/main"]


def trees(*files):
    return lvc.only_changed_trees(list(files), BUILT, ENTRIES)


class TestTreeOf(unittest.TestCase):
    def test_file_in_version_tree(self):
        self.assertEqual(lvc.tree_of("content/docs/standalone/main/a/b.md"), "standalone/main")

    def test_shared_paths(self):
        for path in (
            "assets/agw-docs/snippets/x.md",
            "layouts/partials/x.html",
            "hugo.yaml",
            "content/docs/kubernetes/_content.gotmpl",
            "content/docs/kubernetes/_index.md",
            "content/blog/post.md",
        ):
            with self.subTest(path=path):
                self.assertIsNone(lvc.tree_of(path))


class TestOnlyChangedTrees(unittest.TestCase):
    def test_only_tree_changes_build_only_those_trees(self):
        self.assertEqual(trees("content/docs/standalone/main/a.md"), {"standalone/main"})

    def test_only_shared_changes_build_first_version_everywhere(self):
        self.assertEqual(
            trees("assets/agw-docs/snippets/x.md"), {"kubernetes/main", "standalone/main"}
        )

    def test_tree_plus_shared_keeps_fallback_trees(self):
        # Regression: a branch that edits standalone/main plus a shared asset
        # used by the Kubernetes docs used to build only standalone/main, so a
        # rendering error in the shared Kubernetes content went unnoticed.
        self.assertEqual(
            trees("content/docs/standalone/main/a.md", "assets/agw-docs/pages/k8s.md"),
            {"standalone/main", "kubernetes/main"},
        )

    def test_tree_outside_fallback_plus_shared(self):
        self.assertEqual(
            trees("content/docs/kubernetes/latest/a.md", "layouts/partials/x.html"),
            {"kubernetes/latest", "kubernetes/main", "standalone/main"},
        )

    def test_empty_diff_builds_first_version(self):
        self.assertEqual(trees(), {"kubernetes/main", "standalone/main"})


if __name__ == "__main__":
    unittest.main()
