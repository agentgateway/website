#!/usr/bin/env python3
"""Tests for reuse_consumers.

Run: python3 -m unittest discover -s scripts -p 'test_*.py'

Two halves. The first builds a small tree on disk and asserts the graph walk,
so the shapes that matter are stated outright rather than inferred from the
real tree. The second runs against the REAL repository, because the bug this
script fixes was a heuristic that looked correct and did not match the tree it
was aimed at -- a unit test over a fixture would have passed for the old code
too.

Stdlib unittest only, matching the other scripts here, and no network.
"""

import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import reuse_consumers as rc  # noqa: E402

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


def write(root: pathlib.Path, rel: str, body: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


class GraphWalkTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def index(self):
        return rc.build_reverse_index(self.root)

    def test_a_direct_reuse_is_found(self):
        write(self.root, "assets/agw-docs/snippets/a.md", "body")
        write(self.root, "content/docs/x.md", '{{< reuse "agw-docs/snippets/a.md" >}}')
        self.assertEqual(
            rc.consumers(["assets/agw-docs/snippets/a.md"], self.index()),
            ["content/docs/x.md"],
        )

    def test_a_snippet_reached_through_another_snippet_is_found(self):
        # The openai case, which is what the old path mirror could not do: the
        # page and the snippet share no path segments, and the link between
        # them runs through a third file.
        write(self.root, "assets/agw-docs/pages/llm/providers/openai.md", "body")
        write(
            self.root,
            "assets/agw-docs/pages/quickstart/llm.md",
            '{{< reuse "agw-docs/pages/llm/providers/openai.md" >}}',
        )
        write(
            self.root,
            "content/docs/kubernetes/main/documentation/quickstart/llm.md",
            '{{< reuse "agw-docs/pages/quickstart/llm.md" >}}',
        )
        self.assertEqual(
            rc.consumers(
                ["assets/agw-docs/pages/llm/providers/openai.md"], self.index()
            ),
            ["content/docs/kubernetes/main/documentation/quickstart/llm.md"],
        )

    def test_a_page_outside_the_mirrored_prefixes_is_found(self):
        # `integrations/` is neither the version root nor `documentation/`, the
        # only two prefixes the old mirror knew.
        write(self.root, "assets/agw-docs/pages/llm/providers/openai.md", "body")
        write(
            self.root,
            "content/docs/kubernetes/main/integrations/llm/providers/openai.md",
            '{{< reuse "agw-docs/pages/llm/providers/openai.md" >}}',
        )
        self.assertEqual(
            rc.consumers(
                ["assets/agw-docs/pages/llm/providers/openai.md"], self.index()
            ),
            ["content/docs/kubernetes/main/integrations/llm/providers/openai.md"],
        )

    def test_both_shortcode_delimiters_and_reuse_append_count(self):
        write(self.root, "assets/agw-docs/snippets/a.md", "body")
        write(self.root, "content/docs/angle.md", '{{< reuse "agw-docs/snippets/a.md" >}}')
        write(self.root, "content/docs/percent.md", '{{% reuse "agw-docs/snippets/a.md" %}}')
        write(
            self.root,
            "content/docs/append.md",
            '{{< reuse-append "agw-docs/snippets/a.md" >}}',
        )
        self.assertEqual(
            rc.consumers(["assets/agw-docs/snippets/a.md"], self.index()),
            ["content/docs/angle.md", "content/docs/append.md", "content/docs/percent.md"],
        )

    def test_a_changed_content_page_is_returned_as_itself(self):
        # The workflow hands over the whole changed-file list, pages included.
        write(self.root, "content/docs/x.md", "no reuse here")
        self.assertEqual(
            rc.consumers(["content/docs/x.md"], self.index()), ["content/docs/x.md"]
        )

    def test_the_include_shortcode_is_an_edge_too(self):
        # `doc_test_extract` follows `include` as well as `reuse`, and the two
        # have to agree on what counts as an inclusion. No page uses it today,
        # so this fixture is the only thing keeping the agreement true.
        write(self.root, "content/docs/shared.md", "body")
        write(self.root, "content/docs/x.md", '{{< include "docs/shared.md" >}}')
        self.assertEqual(
            rc.consumers(["content/docs/shared.md"], self.index()),
            ["content/docs/shared.md", "content/docs/x.md"],
        )

    def test_an_include_without_a_suffix_finds_the_section_index(self):
        # The extractor tries `<target>.md` then `<target>/_index.md`; a
        # resolver that only tried the first would miss a section include.
        write(self.root, "content/docs/section/_index.md", "body")
        write(self.root, "content/docs/x.md", '{{< include "docs/section" >}}')
        self.assertIn(
            "content/docs/x.md", rc.consumers(["content/docs/section/_index.md"], self.index())
        )

    def test_unresolved_names_the_file_that_went_nowhere(self):
        # The warning has to say WHICH file selected nothing. "Some of your
        # snippets reach no page" is the old useless message with new wording.
        write(self.root, "assets/agw-docs/snippets/used.md", "body")
        write(self.root, "assets/agw-docs/snippets/orphan.md", "body")
        write(
            self.root, "content/docs/x.md", '{{< reuse "agw-docs/snippets/used.md" >}}'
        )
        self.assertEqual(
            rc.unresolved(
                [
                    "assets/agw-docs/snippets/used.md",
                    "assets/agw-docs/snippets/orphan.md",
                ],
                self.index(),
            ),
            ["assets/agw-docs/snippets/orphan.md"],
        )

    def test_only_an_orphan_with_tests_is_warning_worthy(self):
        # 125 snippets in the real tree reach no page. Warning on all of them
        # would bury the one case that means a test went dark.
        write(self.root, "assets/agw-docs/snippets/quiet-orphan.md", "body")
        write(
            self.root,
            "assets/agw-docs/snippets/costly-orphan.md",
            'body\n{{< doc-test name="x" >}}',
        )
        changed = [
            "assets/agw-docs/snippets/quiet-orphan.md",
            "assets/agw-docs/snippets/costly-orphan.md",
        ]
        self.assertEqual(sorted(rc.unresolved(changed, self.index())), sorted(changed))
        self.assertEqual(
            rc.unresolved_losing_tests(changed, self.index(), self.root),
            ["assets/agw-docs/snippets/costly-orphan.md"],
        )

    def test_a_cycle_terminates(self):
        # Not hypothetical enough to ignore: a snippet pair that includes each
        # other would otherwise hang the discover job rather than fail it.
        write(
            self.root,
            "assets/agw-docs/snippets/a.md",
            '{{< reuse "agw-docs/snippets/b.md" >}}',
        )
        write(
            self.root,
            "assets/agw-docs/snippets/b.md",
            '{{< reuse "agw-docs/snippets/a.md" >}}',
        )
        write(self.root, "content/docs/x.md", '{{< reuse "agw-docs/snippets/a.md" >}}')
        self.assertEqual(
            rc.consumers(["assets/agw-docs/snippets/b.md"], self.index()),
            ["content/docs/x.md"],
        )

    def test_an_orphan_snippet_resolves_to_nothing(self):
        write(self.root, "assets/agw-docs/snippets/unused.md", "body")
        self.assertEqual(
            rc.consumers(["assets/agw-docs/snippets/unused.md"], self.index()), []
        )


class TestDependencyEdgeTests(unittest.TestCase):
    """The front-matter `test:` relation, which reuse cannot see."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def indexes(self):
        return rc.build_reverse_index(self.root), rc.build_test_dependency_index(self.root)

    def page(self, rel, body="", test_block=""):
        fm = f"---\ntitle: x\n{test_block}---\n\n"
        write(self.root, rel, fm + body)

    def test_a_setup_step_on_another_page_is_an_edge(self):
        # The rate-limit shape: the test runs install/helm.md's blocks, but the
        # page reuses nothing from it, so only this edge connects them.
        self.page("content/docs/kubernetes/main/documentation/install/helm.md")
        self.page(
            "content/docs/kubernetes/main/documentation/security/rate-limit.md",
            test_block=(
                "test:\n"
                "  rl:\n"
                "  - file: ${versionRoot}/documentation/install/helm.md\n"
                "    path: standard\n"
            ),
        )
        inc, tst = self.indexes()
        self.assertIn(
            "content/docs/kubernetes/main/documentation/security/rate-limit.md",
            rc.consumers(
                ["content/docs/kubernetes/main/documentation/install/helm.md"],
                inc,
                test_index=tst,
            ),
        )

    def test_a_snippet_reaches_tests_through_the_page_that_reuses_it(self):
        # The real chain this exists for: version snippet -> install page
        # (reuse) -> every test that runs that page's blocks (dependency).
        write(self.root, "assets/agw-docs/versions/helm-version-flag.md", "1.0.0")
        self.page(
            "content/docs/kubernetes/main/documentation/install/helm.md",
            body='{{< reuse "agw-docs/versions/helm-version-flag.md" >}}',
        )
        self.page(
            "content/docs/kubernetes/main/documentation/security/rate-limit.md",
            test_block=(
                "test:\n"
                "  rl:\n"
                "  - file: ${versionRoot}/documentation/install/helm.md\n"
                "    path: standard\n"
            ),
        )
        inc, tst = self.indexes()
        self.assertIn(
            "content/docs/kubernetes/main/documentation/security/rate-limit.md",
            rc.consumers(
                ["assets/agw-docs/versions/helm-version-flag.md"], inc, test_index=tst
            ),
        )

    def test_test_dependencies_do_not_chain(self):
        """A depends on B's blocks, B depends on C's blocks.

        Changing C changes B's TEST, but not B's CONTENT, so A is untouched.

        This fixture is the only place the property is pinned, and it needs
        to be, because the effect on the real tree is small enough to hide: a
        changed snippet gives the same answer either way, and only a changed
        test-step source differs at all (`install/helm.md`, 24 pages against
        29). Small is not the same as right, and nothing about the shape
        guarantees it stays small.
        """
        self.page("content/docs/kubernetes/main/documentation/c.md")
        self.page(
            "content/docs/kubernetes/main/documentation/b.md",
            test_block="test:\n  t:\n  - file: ${versionRoot}/documentation/c.md\n    path: p\n",
        )
        self.page(
            "content/docs/kubernetes/main/documentation/a.md",
            test_block="test:\n  t:\n  - file: ${versionRoot}/documentation/b.md\n    path: p\n",
        )
        inc, tst = self.indexes()
        got = rc.consumers(
            ["content/docs/kubernetes/main/documentation/c.md"], inc, test_index=tst
        )
        self.assertIn("content/docs/kubernetes/main/documentation/b.md", got)
        self.assertNotIn(
            "content/docs/kubernetes/main/documentation/a.md",
            got,
            "a test dependency moves no content, so it must not chain",
        )

    def test_a_self_referencing_step_adds_no_edge(self):
        # `file` defaults to the declaring page; the page is already returned
        # as itself, and a self-edge would make every tested page its own
        # consumer for no gain.
        self.page(
            "content/docs/kubernetes/main/documentation/x.md",
            test_block="test:\n  t:\n  - file: ${versionRoot}/documentation/x.md\n    path: p\n",
        )
        _, tst = self.indexes()
        self.assertEqual(tst, {})


class RealRepositoryTests(unittest.TestCase):
    """Against the tree as it actually is, which is where the old code failed."""

    @classmethod
    def setUpClass(cls):
        cls.index = rc.build_reverse_index(REPO_ROOT)
        cls.test_index = rc.build_test_dependency_index(REPO_ROOT)

    def test_the_openai_snippet_reaches_its_quickstart_page(self):
        pages = rc.consumers(
            ["assets/agw-docs/pages/agentgateway/llm/providers/openai.md"],
            self.index,
            test_index=self.test_index,
        )
        self.assertIn(
            "content/docs/kubernetes/main/documentation/quickstart/llm.md",
            pages,
            "the two-hop reuse through quickstart/llm.md is the case this fixes",
        )
        self.assertIn(
            "content/docs/kubernetes/main/integrations/llm/providers/openai.md",
            pages,
            "integrations/ was outside the old prefix list",
        )

    def test_nearly_every_doc_test_snippet_now_resolves(self):
        """A budget, not a moving target.

        62 of the 134 snippets carrying doc tests resolved to no page under
        the path mirror, and each of those was a check that could not fail.
        Five still resolve to nothing, and all five are genuinely unreferenced --
        version-pinned leftovers such as `trace-requests-standalone-12x.md`
        that no page reuses any more. They are dead files rather than a gap in
        this walk, so the budget allows them and nothing more: a regression
        here, or a new orphan, should be looked at rather than absorbed.
        """
        unresolved = []
        for snippet in sorted((REPO_ROOT / "assets").rglob("*.md")):
            text = snippet.read_text(encoding="utf-8", errors="ignore")
            if "{{< doc-test" not in text:
                continue
            rel = snippet.relative_to(REPO_ROOT).as_posix()
            if not rc.consumers([rel], self.index, test_index=self.test_index):
                unresolved.append(rel)
        self.assertLessEqual(
            len(unresolved),
            5,
            f"snippets with doc tests that reach no page: {unresolved}",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
