#!/usr/bin/env python3
"""
Tests for normalize_doc_links.

Run: python3 -m unittest discover -s scripts -p 'test_*.py'

Every case here is one a reviewer can check by hand against the live site, and most of
them exist because the behaviour was measured rather than assumed. Stdlib unittest only,
matching the rest of scripts/, which has no pytest dependency.
"""

import os
import sys
import tempfile
import textwrap
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import normalize_doc_links as n  # noqa: E402

SITE = n.SITE


def _write(root, rel, body):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(textwrap.dedent(body).lstrip("\n"))
    return path


class TestRedirectMatching(unittest.TestCase):
    """Cloudflare _redirects semantics: file order, placeholders, splats."""

    def test_first_match_wins(self):
        rules = [("/a/", "/first/"), ("/a/", "/second/")]
        self.assertEqual(n.resolve("/a/", rules), "/first/")

    def test_placeholder_matches_one_segment(self):
        rules = [("/docs/:section/:version/old/", "/docs/:section/:version/new/")]
        self.assertEqual(
            n.resolve("/docs/kubernetes/latest/old/", rules),
            "/docs/kubernetes/latest/new/",
        )

    def test_placeholder_does_not_span_a_slash(self):
        rules = [("/docs/:section/old/", "/docs/:section/new/")]
        self.assertEqual(n.resolve("/docs/a/b/old/", rules), "/docs/a/b/old/")

    def test_splat_matches_the_rest_including_empty(self):
        rules = [("/install*", "/setup:splat")]
        self.assertEqual(n.resolve("/install", rules), "/setup")
        self.assertEqual(n.resolve("/install/helm/", rules), "/setup/helm/")

    def test_offsite_targets_are_skipped(self):
        """A docs link must never be rewritten into a raw.githubusercontent download."""
        with tempfile.TemporaryDirectory() as root:
            path = os.path.join(root, "_redirects")
            with open(path, "w", encoding="utf-8") as f:
                f.write(
                    "# comment\n"
                    "/schema/config https://raw.githubusercontent.com/x/y/config.json\n"
                    "/old/ /new/\n"
                )
            self.assertEqual(n.load_rules(path), [("/old/", "/new/")])

    def test_chain_is_followed(self):
        rules = [("/a/", "/b/"), ("/b/", "/c/")]
        self.assertEqual(n.resolve("/a/", rules), "/c/")

    def test_cycle_raises_rather_than_hanging(self):
        with self.assertRaises(ValueError):
            n.resolve("/a/", [("/a/", "/b/"), ("/b/", "/a/")])


class TestNormalizeText(unittest.TestCase):
    RULES = [("/docs/old/", "/docs/new/")]

    def test_rewrites_and_preserves_the_anchor(self):
        out = n.normalize_text(f"see {SITE}/docs/old/#section now", self.RULES)
        self.assertIn(f"{SITE}/docs/new/#section", out)

    def test_sentence_punctuation_is_not_part_of_the_url(self):
        out = n.normalize_text(f"See {SITE}/docs/old/.", self.RULES)
        self.assertEqual(out, f"See {SITE}/docs/new/.")

    def test_query_string_rides_along(self):
        out = n.normalize_text(f"{SITE}/docs/old/?a=1", self.RULES)
        self.assertIn("/docs/new/?a=1", out)

    def test_unmatched_url_is_untouched(self):
        text = f"{SITE}/docs/unrelated/"
        self.assertEqual(n.normalize_text(text, self.RULES), text)

    def test_idempotent(self):
        once = n.normalize_text(f"{SITE}/docs/old/", self.RULES)
        self.assertEqual(n.normalize_text(once, self.RULES), once)

    def test_a_cycle_affects_only_its_own_url(self):
        """One bad pair must not abort a whole nightly regeneration."""
        rules = [("/docs/a/", "/docs/b/"), ("/docs/b/", "/docs/a/")] + self.RULES
        errors = []
        out = n.normalize_text(
            f"{SITE}/docs/a/ and {SITE}/docs/old/",
            rules,
            on_error=lambda url, msg: errors.append(url),
        )
        self.assertIn(f"{SITE}/docs/a/", out)      # left alone
        self.assertIn(f"{SITE}/docs/new/", out)    # still fixed
        self.assertEqual(len(errors), 1)

    def test_target_veto_blocks_a_rewrite_to_a_missing_page(self):
        errors = []
        text = f"{SITE}/docs/old/"
        out = n.normalize_text(
            text,
            self.RULES,
            on_error=lambda url, msg: errors.append(msg),
            target_exists=lambda path: False,
        )
        self.assertEqual(out, text)
        self.assertEqual(len(errors), 1)


class TestAliasSweep(unittest.TestCase):
    """The alias half of the rule set, which _redirects does not contain."""

    def _tree(self, root, files):
        for rel, body in files.items():
            _write(root, os.path.join("content", "docs", rel), body)

    def test_alias_points_at_the_declaring_page(self):
        with tempfile.TemporaryDirectory() as root:
            self._tree(root, {
                "standalone/latest/documentation/setup/storage.md": """
                    ---
                    title: Storage
                    aliases:
                      - /docs/standalone/latest/deployment/helm/storage/
                    ---
                """,
            })
            self.assertEqual(
                n.load_alias_rules(root),
                [(
                    "/docs/standalone/latest/deployment/helm/storage/",
                    "/docs/standalone/latest/documentation/setup/storage/",
                )],
            )

    def test_index_page_resolves_to_its_directory(self):
        with tempfile.TemporaryDirectory() as root:
            self._tree(root, {
                "standalone/latest/documentation/setup/_index.md": """
                    ---
                    title: Setup
                    aliases:
                      - /docs/standalone/latest/deployment/
                    ---
                """,
            })
            self.assertEqual(
                n.load_alias_rules(root)[0][1],
                "/docs/standalone/latest/documentation/setup/",
            )

    def test_explicit_url_front_matter_wins(self):
        """Several inference pages set url:; deriving from the path would be wrong."""
        with tempfile.TemporaryDirectory() as root:
            self._tree(root, {
                "kubernetes/latest/documentation/llm/inference/_index.md": """
                    ---
                    title: Inference
                    url: /docs/kubernetes/latest/documentation/inference/
                    aliases:
                      - /docs/kubernetes/latest/documentation/llm/inference/
                    ---
                """,
            })
            self.assertEqual(
                n.load_alias_rules(root)[0][1],
                "/docs/kubernetes/latest/documentation/inference/",
            )

    def test_alias_claimed_by_two_pages_is_dropped(self):
        """Hugo lets the last build win, so the live target is not knowable here."""
        with tempfile.TemporaryDirectory() as root:
            self._tree(root, {
                "kubernetes/latest/a.md": """
                    ---
                    aliases: [/docs/kubernetes/latest/shared/]
                    ---
                """,
                "kubernetes/latest/b.md": """
                    ---
                    aliases: [/docs/kubernetes/latest/shared/]
                    ---
                """,
            })
            skipped = []
            rules = n.load_alias_rules(root, on_skip=lambda a, r, p: skipped.append(r))
            self.assertEqual(rules, [])
            self.assertIn("claimed by 2 pages", skipped)

    def test_non_absolute_alias_is_dropped(self):
        """`windsurf` and `vllm` are declared without a leading slash."""
        with tempfile.TemporaryDirectory() as root:
            self._tree(root, {
                "kubernetes/latest/clients/devin.md": """
                    ---
                    aliases: [windsurf]
                    ---
                """,
            })
            skipped = []
            rules = n.load_alias_rules(root, on_skip=lambda a, r, p: skipped.append(r))
            self.assertEqual(rules, [])
            self.assertIn("not site-absolute", skipped)

    def test_cross_tree_alias_is_dropped(self):
        """A 1.4.x page claiming a /latest/ path must not capture latest links."""
        with tempfile.TemporaryDirectory() as root:
            self._tree(root, {
                "kubernetes/1.4.x/documentation/llm/inference/_index.md": """
                    ---
                    aliases:
                      - /docs/kubernetes/latest/documentation/llm/inference/
                    ---
                """,
            })
            skipped = []
            rules = n.load_alias_rules(root, on_skip=lambda a, r, p: skipped.append(r))
            self.assertEqual(rules, [])
            self.assertTrue(any("1.4.x" in r for r in skipped))

    def test_alias_containing_pattern_syntax_is_dropped(self):
        """A literal ':' would otherwise be read as a Cloudflare placeholder."""
        with tempfile.TemporaryDirectory() as root:
            self._tree(root, {
                "kubernetes/latest/page.md": """
                    ---
                    aliases: ["/docs/kubernetes/latest/a:b/"]
                    ---
                """,
            })
            skipped = []
            rules = n.load_alias_rules(root, on_skip=lambda a, r, p: skipped.append(r))
            self.assertEqual(rules, [])
            self.assertIn("contains pattern syntax", skipped)


class TestStubSweep(unittest.TestCase):
    """The {{< redirect >}} stub half, which is neither a 301 nor an alias."""

    def test_path_argument_is_version_relative(self):
        with tempfile.TemporaryDirectory() as root:
            _write(root, "content/docs/kubernetes/latest/documentation/security/access-logging.md", """
                ---
                title: Access logging
                ---
                {{< redirect path="documentation/observability/access-logs/view/" >}}
            """)
            self.assertEqual(
                n.load_stub_rules(root),
                [(
                    "/docs/kubernetes/latest/documentation/security/access-logging/",
                    "/docs/kubernetes/latest/documentation/observability/access-logs/view/",
                )],
            )

    def test_leading_slash_on_path_is_still_version_relative(self):
        with tempfile.TemporaryDirectory() as root:
            _write(root, "content/docs/standalone/main/x.md", """
                ---
                title: X
                ---
                {{< redirect path="/integrations/llm/providers/" >}}
            """)
            self.assertEqual(
                n.load_stub_rules(root)[0][1],
                "/docs/standalone/main/integrations/llm/providers/",
            )

    def test_url_argument_is_used_as_is(self):
        with tempfile.TemporaryDirectory() as root:
            _write(root, "content/docs/kubernetes/latest/y.md", """
                ---
                title: Y
                ---
                {{< redirect url="/docs/kubernetes/latest/reference/cel/" >}}
            """)
            self.assertEqual(
                n.load_stub_rules(root)[0][1],
                "/docs/kubernetes/latest/reference/cel/",
            )


class TestRuleOrdering(unittest.TestCase):
    def test_redirects_lead_and_the_chain_crosses_all_three_sources(self):
        """The live chain is _redirects -> stub page; both halves must be present."""
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, "static"), exist_ok=True)
            with open(os.path.join(root, "static", "_redirects"), "w") as f:
                f.write("/docs/:section/:version/security* /docs/:section/:version/documentation/security:splat\n")
            _write(root, "content/docs/kubernetes/latest/documentation/security/access-logging.md", """
                ---
                title: Access logging
                ---
                {{< redirect path="documentation/observability/access-logs/view/" >}}
            """)
            rules = n.all_rules(root)
            self.assertEqual(
                n.resolve("/docs/kubernetes/latest/security/access-logging/", rules),
                "/docs/kubernetes/latest/documentation/observability/access-logs/view/",
            )


class TestVersionRetargeting(unittest.TestCase):
    def test_skips_when_the_content_tree_does_not_exist_yet(self):
        with tempfile.TemporaryDirectory() as root:
            text = f"{SITE}/docs/kubernetes/latest/documentation/quickstart/"
            skips = []
            out = n.retarget_version(text, "1.5.x", root, on_skip=lambda s, v, u: skips.append(u))
            self.assertEqual(out, text)
            self.assertEqual(len(skips), 1)

    def test_rewrites_when_the_tree_exists(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, "content", "docs", "kubernetes", "1.5.x"))
            out = n.retarget_version(
                f"{SITE}/docs/kubernetes/latest/documentation/quickstart/", "1.5.x", root
            )
            self.assertEqual(out, f"{SITE}/docs/kubernetes/1.5.x/documentation/quickstart/")


if __name__ == "__main__":
    unittest.main(verbosity=2)
