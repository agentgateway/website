#!/usr/bin/env python3
"""Generate a GitHub Actions Job Summary (Markdown) from test-results.yaml.

Usage:
    python3 scripts/report_summary.py out/tests/generated/test-results.yaml >> "$GITHUB_STEP_SUMMARY"
    python3 scripts/report_summary.py --slack out/tests/generated/test-results.yaml  # Slack Block Kit JSON
"""

import json
import sys
from pathlib import Path

try:
    import yaml  # type: ignore[import-not-found]
except ModuleNotFoundError:
    print("PyYAML is required. Install it with: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

# Slack Block Kit limits
_SLACK_TEXT_LIMIT = 3000
_SLACK_MAX_BLOCKS = 50


def _status_icon(status: str) -> str:
    return "\u2705" if status == "passed" else "\u274c"


def _escape_md_table(text: str) -> str:
    """Escape pipe characters so they don't break Markdown table cells."""
    return text.replace("|", "\\|").replace("\n", " ")


def _format_checks(checks: list) -> str:
    if not checks:
        return "\u2014"
    n = len(checks)
    return f"{n} check{'s' if n != 1 else ''} passed"


def _format_checks_count(n: int) -> str:
    if n == 0:
        return "\u2014"
    return f"{n} check{'s' if n != 1 else ''} passed"


def _coverage_rows(tested_documents: list, total_by_version: dict, total_documents: int) -> list[tuple[str, int, int]]:
    """Return sorted rows of (version, tested_count, total_count) for coverage table."""
    tested_by_version: dict[str, int] = {}
    for doc in tested_documents:
        vk = _extract_version(doc)
        tested_by_version[vk] = tested_by_version.get(vk, 0) + 1

    versions = sorted(set(list(total_by_version.keys()) + list(tested_by_version.keys())))
    rows = []
    for v in versions:
        rows.append((v, tested_by_version.get(v, 0), total_by_version.get(v, 0)))
    return rows


def _coverage_section_md(tested_documents: list, total_by_version: dict, total_documents: int) -> list[str]:
    """Build Markdown lines for a coverage section."""
    if total_documents == 0:
        return []
    tested_total = len(set(tested_documents))
    pct = int(tested_total / total_documents * 100)
    lines: list[str] = []
    lines.append(f"### Coverage \u2014 {tested_total} / {total_documents} pages tested ({pct}%)")
    lines.append("")
    rows = _coverage_rows(tested_documents, total_by_version, total_documents)
    if rows:
        lines.append("| Product/Version | Tested | Total | Coverage |")
        lines.append("|:---|---:|---:|---:|")
        for version, tested, total in rows:
            row_pct = f"{int(tested / total * 100)}%" if total else "—"
            lines.append(f"| `{version}` | {tested} | {total} | {row_pct} |")
        lines.append(f"| **Total** | **{tested_total}** | **{total_documents}** | **{pct}%** |")
    lines.append("")
    return lines


def generate_summary(report: dict) -> str:
    lines: list[str] = []

    tests: dict = report.get("tests", {})
    tested_documents: list = report.get("tested_documents", [])
    total_documents: int = report.get("total_documents", 0)
    total_by_version: dict = report.get("total_documents_by_version", {})

    if not tests:
        lines.append("## Doc Test Results")
        lines.append("")
        lines.append("No test results found.")
        return "\n".join(lines)

    doc_groups = _group_by_document(tests)
    total = len(doc_groups)
    passed = sum(1 for g in doc_groups.values() if g["status"] == "passed")
    failed = total - passed

    # Header
    if failed == 0:
        lines.append(f"## \u2705 Doc Test Results \u2014 {passed} passed | {total} total")
    else:
        lines.append(f"## \u274c Doc Test Results \u2014 {passed} passed | {failed} failed | {total} total")
    lines.append("")

    # Coverage section
    lines.extend(_coverage_section_md(tested_documents, total_by_version, total_documents))

    # Results table — one row per document
    lines.append("| Status | Test | Document | Checks |")
    lines.append("|:------:|------|----------|--------|")

    failed_tests: list[tuple[str, dict]] = []

    for doc, group in doc_groups.items():
        status = group["status"]
        icon = _status_icon(status)
        test_label = _escape_md_table(_format_test_names(group["tests"]))
        check_count = group["check_count"]
        checks_str = _format_checks_count(check_count)

        lines.append(f"| {icon} | `{test_label}` | `{_escape_md_table(doc)}` | {checks_str} |")

    for key, result in tests.items():
        if result.get("status") != "passed" and result.get("error"):
            failed_tests.append((key, result))

    # Failed test details
    if failed_tests:
        lines.append("")
        lines.append("### Failed Tests")
        lines.append("")

        for key, result in failed_tests:
            parts = key.split("::", 1)
            doc = parts[0] if len(parts) > 0 else key
            test_name = parts[1] if len(parts) > 1 else key
            version = _extract_version(doc)
            title = f"{test_name} ({version})" if version else test_name
            error = result.get("error", "No error output captured.")

            # Show individual checks if any passed before failure
            checks = result.get("checks", [])

            lines.append(f"<details>")
            lines.append(f"<summary><strong>{_escape_md_table(title)}</strong></summary>")
            lines.append("")

            if checks:
                lines.append("**Checks:**")
                for check in checks:
                    lines.append(f"- {check}")
                lines.append("")

            lines.append("**Error output:**")
            lines.append("")
            lines.append("```")
            lines.append(error)
            lines.append("```")
            lines.append("")
            lines.append("</details>")
            lines.append("")

    return "\n".join(lines)


def _truncate(text: str, limit: int = _SLACK_TEXT_LIMIT, suffix: str = "\n... (truncated)") -> str:
    """Truncate text to fit within Slack's field character limit."""
    if len(text) <= limit:
        return text
    return text[: limit - len(suffix)] + suffix


def _truncate_tail(text: str, limit: int = _SLACK_TEXT_LIMIT // 2, prefix: str = "(truncated) ...\n") -> str:
    """Keep the tail of text, truncating from the beginning."""
    if len(text) <= limit:
        return text
    return prefix + text[-(limit - len(prefix)):]


def _group_by_document(tests: dict) -> dict:
    """Collapse per-test results into per-document groups.

    Returns an ordered dict keyed by doc path, each value being a dict with:
      - status: "passed" if all tests passed, else "failed"
      - tests: list of test names in order
      - check_count: total number of checks across all tests
    """
    groups: dict = {}
    for key, result in tests.items():
        parts = key.split("::", 1)
        doc = parts[0] if len(parts) > 0 else key
        test_name = parts[1] if len(parts) > 1 else key
        if doc not in groups:
            groups[doc] = {"status": "passed", "tests": [], "check_count": 0}
        groups[doc]["tests"].append(test_name)
        groups[doc]["check_count"] += len(result.get("checks", []))
        if result.get("status") != "passed":
            groups[doc]["status"] = "failed"
    return groups


def _format_test_names(tests: list) -> str:
    """Format a list of test names as 'first' or 'first + N more'."""
    if not tests:
        return ""
    if len(tests) == 1:
        return tests[0]
    return f"{tests[0]} + {len(tests) - 1} more"


def _extract_version(doc_path: str) -> str:
    """Extract the version segment from a doc path.

    Expects paths like ``content/docs/kubernetes/main/...`` and returns
    the two segments immediately following ``docs/``, e.g. ``kubernetes/main``.
    """
    path_parts = doc_path.replace("\\", "/").split("/")
    try:
        idx = path_parts.index("docs")
        return "/".join(path_parts[idx + 1 : idx + 3])
    except (ValueError, IndexError):
        return ""


def _run_url_block(run_url: str) -> dict:
    """Build a context block with a link to the GitHub Actions run."""
    return {
        "type": "context",
        "elements": [
            {"type": "mrkdwn", "text": f"<{run_url}|View workflow run>"}
        ],
    }


def _coverage_slack_text(tested_documents: list, total_by_version: dict, total_documents: int) -> str | None:
    """Build a compact Slack mrkdwn string for coverage, or None if no data."""
    if total_documents == 0:
        return None
    tested_total = len(set(tested_documents))
    pct = int(tested_total / total_documents * 100)
    rows = _coverage_rows(tested_documents, total_by_version, total_documents)
    lines = [f"*Coverage \u2014 {tested_total} / {total_documents} pages tested ({pct}%)*"]
    for version, tested, total in rows:
        row_pct = f"{int(tested / total * 100)}%" if total else "—"
        lines.append(f"  `{version}`: {tested}/{total} ({row_pct})")
    return "\n".join(lines)


def generate_slack_blocks(report: dict, run_url: str | None = None) -> tuple[dict, dict | None]:
    """Generate a Slack Block Kit payload from test results.

    Returns a tuple of ``(main_payload, thread_payload)`` where each payload
    has ``text`` and ``blocks`` keys ready for chat.postMessage.
    ``thread_payload`` is ``None`` when there are no failures.
    """
    tests: dict = report.get("tests", {})
    tested_documents: list = report.get("tested_documents", [])
    total_documents: int = report.get("total_documents", 0)
    total_by_version: dict = report.get("total_documents_by_version", {})

    # --- empty results ---
    if not tests:
        fallback = "Doc Test Results — no test results found."
        blocks: list[dict] = [
            {"type": "header", "text": {"type": "plain_text", "text": "Doc Test Results"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": "No test results found."}},
        ]
        if run_url:
            blocks.append(_run_url_block(run_url))
        return {"text": fallback, "blocks": blocks}, None

    doc_groups = _group_by_document(tests)
    total = len(doc_groups)
    passed = sum(1 for g in doc_groups.values() if g["status"] == "passed")
    failed = total - passed

    # --- header ---
    if failed == 0:
        header_text = f"\u2705 Doc Test Results \u2014 {passed} passed | {total} total"
    else:
        header_text = f"\u274c Doc Test Results \u2014 {passed} passed | {failed} failed | {total} total"

    # Header block text is limited to 150 chars and plain_text only
    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": header_text[:150]}},
    ]

    # --- coverage block ---
    coverage_text = _coverage_slack_text(tested_documents, total_by_version, total_documents)
    if coverage_text:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": _truncate(coverage_text)}})

    # --- split results into failed and passed lists ---
    failed_lines: list[str] = []
    passed_lines: list[str] = []
    failed_tests: list[tuple[str, dict]] = []

    for doc, group in doc_groups.items():
        status = group["status"]
        icon = _status_icon(status)
        test_label = _format_test_names(group["tests"])
        checks_str = _format_checks_count(group["check_count"])
        line = f"{icon}  `{test_label}` \u2014 {checks_str}  (_`{doc}`_)"
        if status == "passed":
            passed_lines.append(line)
        else:
            failed_lines.append(line)

    for key, result in tests.items():
        if result.get("status") != "passed" and result.get("error"):
            failed_tests.append((key, result))

    # Main body: failed docs only (or all-passed note)
    if failed_lines:
        main_body = _truncate("\n".join(failed_lines))
    else:
        main_body = "\u2705 All documents passed."
    blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": main_body}})

    # --- workflow run link ---
    if run_url and len(blocks) < _SLACK_MAX_BLOCKS:
        blocks.append(_run_url_block(run_url))

    main_payload = {"text": header_text, "blocks": blocks}

    # --- thread reply: failed details + passed tests ---
    if not failed_tests and not passed_lines:
        return main_payload, None

    thread_blocks: list[dict] = []

    if failed_tests:
        thread_blocks.append(
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*Failed Tests ({len(failed_tests)})*"}}
        )
        for key, result in failed_tests:
            if len(thread_blocks) >= _SLACK_MAX_BLOCKS - 1:
                thread_blocks.append(
                    {"type": "section", "text": {"type": "mrkdwn", "text": "_... additional failures omitted (block limit reached)_"}}
                )
                break

            parts = key.split("::", 1)
            doc = parts[0] if len(parts) > 0 else key
            test_name = parts[1] if len(parts) > 1 else key
            version = _extract_version(doc)
            title = f"{test_name} ({version})" if version else test_name
            error = result.get("error", "No error output captured.")
            checks = result.get("checks", [])

            detail_parts: list[str] = [f"*`{title}`*"]
            if checks:
                detail_parts.append("*Checks:*  " + ", ".join(checks))
            detail_parts.append(f"```{_truncate_tail(error)}```")

            thread_blocks.append(
                {"type": "section", "text": {"type": "mrkdwn", "text": _truncate("\n".join(detail_parts))}}
            )

    if passed_lines and len(thread_blocks) < _SLACK_MAX_BLOCKS - 1:
        thread_blocks.append(
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*Passed Tests ({passed})*"}}
        )
        thread_blocks.append(
            {"type": "section", "text": {"type": "mrkdwn", "text": _truncate("\n".join(passed_lines))}}
        )

    thread_payload = {"text": f"Failed Tests ({len(failed_tests)})", "blocks": thread_blocks}

    return main_payload, thread_payload


def main() -> int:
    slack_mode = "--slack" in sys.argv
    run_url: str | None = None

    # Extract --run-url value
    argv = list(sys.argv[1:])
    filtered: list[str] = []
    i = 0
    while i < len(argv):
        if argv[i] == "--run-url" and i + 1 < len(argv):
            run_url = argv[i + 1]
            i += 2
        elif argv[i] == "--slack":
            i += 1
        else:
            filtered.append(argv[i])
            i += 1

    if len(filtered) < 1:
        print(f"Usage: {sys.argv[0]} [--slack] [--run-url URL] <test-results.yaml>", file=sys.stderr)
        return 1

    results_path = Path(filtered[0])
    if not results_path.exists():
        print(f"File not found: {results_path}", file=sys.stderr)
        return 1

    with open(results_path, encoding="utf-8") as f:
        report = yaml.safe_load(f) or {}

    if slack_mode:
        main_payload, thread_payload = generate_slack_blocks(report, run_url=run_url)
        print(json.dumps({"main": main_payload, "thread": thread_payload}))
    else:
        summary = generate_summary(report)
        print(summary)

    return 0


if __name__ == "__main__":
    sys.exit(main())
