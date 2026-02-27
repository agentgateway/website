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


def generate_summary(report: dict) -> str:
    lines: list[str] = []

    tests: dict = report.get("tests", {})
    tested_documents: list = report.get("tested_documents", [])

    if not tests:
        lines.append("## Doc Test Results")
        lines.append("")
        lines.append("No test results found.")
        if tested_documents:
            lines.append("")
            lines.append(f"Tested documents ({len(tested_documents)}):")
            for doc in tested_documents:
                lines.append(f"- `{doc}`")
        return "\n".join(lines)

    total = len(tests)
    passed = sum(1 for t in tests.values() if t.get("status") == "passed")
    failed = total - passed

    # Header
    if failed == 0:
        lines.append(f"## \u2705 Doc Test Results \u2014 {passed} passed | {total} total")
    else:
        lines.append(f"## \u274c Doc Test Results \u2014 {passed} passed | {failed} failed | {total} total")
    lines.append("")

    # Results table
    lines.append("| Status | Test | Document | Checks |")
    lines.append("|:------:|------|----------|--------|")

    failed_tests: list[tuple[str, dict]] = []

    for key, result in tests.items():
        # key format: "content/docs/.../file.md::test-name"
        parts = key.split("::", 1)
        doc = parts[0] if len(parts) > 0 else key
        test_name = parts[1] if len(parts) > 1 else key

        status = result.get("status", "unknown")
        icon = _status_icon(status)
        checks = result.get("checks", [])
        checks_str = _escape_md_table(_format_checks(checks))

        lines.append(f"| {icon} | `{_escape_md_table(test_name)}` | `{_escape_md_table(doc)}` | {checks_str} |")

        if status != "passed" and result.get("error"):
            failed_tests.append((key, result))

    # Failed test details
    if failed_tests:
        lines.append("")
        lines.append("### Failed Tests")
        lines.append("")

        for key, result in failed_tests:
            parts = key.split("::", 1)
            test_name = parts[1] if len(parts) > 1 else key
            error = result.get("error", "No error output captured.")

            # Show individual checks if any passed before failure
            checks = result.get("checks", [])

            lines.append(f"<details>")
            lines.append(f"<summary><strong>{_escape_md_table(test_name)}</strong></summary>")
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

    # Tested documents
    if tested_documents:
        lines.append("<details>")
        lines.append(f"<summary><strong>Tested documents ({len(tested_documents)})</strong></summary>")
        lines.append("")
        for doc in tested_documents:
            lines.append(f"- `{doc}`")
        lines.append("")
        lines.append("</details>")

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


def _run_url_block(run_url: str) -> dict:
    """Build a context block with a link to the GitHub Actions run."""
    return {
        "type": "context",
        "elements": [
            {"type": "mrkdwn", "text": f"<{run_url}|View workflow run>"}
        ],
    }


def generate_slack_blocks(report: dict, run_url: str | None = None) -> dict:
    """Generate a Slack Block Kit payload from test results.

    Returns a dict with ``text`` (notification fallback) and ``blocks``
    (Block Kit array) keys, ready to be merged into a chat.postMessage call.
    """
    tests: dict = report.get("tests", {})
    tested_documents: list = report.get("tested_documents", [])

    # --- empty results ---
    if not tests:
        fallback = "Doc Test Results — no test results found."
        blocks: list[dict] = [
            {"type": "header", "text": {"type": "plain_text", "text": "Doc Test Results"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": "No test results found."}},
        ]
        if tested_documents:
            doc_list = "\n".join(f"\u2022 `{d}`" for d in tested_documents)
            blocks.append(
                {"type": "section", "text": {"type": "mrkdwn", "text": _truncate(f"*Tested documents ({len(tested_documents)}):*\n{doc_list}")}}
            )
        if run_url:
            blocks.append(_run_url_block(run_url))
        return {"text": fallback, "blocks": blocks}

    total = len(tests)
    passed = sum(1 for t in tests.values() if t.get("status") == "passed")
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

    # --- results list ---
    result_lines: list[str] = []
    failed_tests: list[tuple[str, dict]] = []

    for key, result in tests.items():
        parts = key.split("::", 1)
        doc = parts[0] if len(parts) > 0 else key
        test_name = parts[1] if len(parts) > 1 else key

        status = result.get("status", "unknown")
        icon = _status_icon(status)
        checks = result.get("checks", [])
        checks_str = _format_checks(checks)

        result_lines.append(f"{icon}  `{test_name}` \u2014 {checks_str}  (_`{doc}`_)")

        if status != "passed" and result.get("error"):
            failed_tests.append((key, result))

    results_text = _truncate("\n".join(result_lines))
    blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": results_text}})

    # --- failed test details ---
    if failed_tests:
        blocks.append({"type": "divider"})
        blocks.append(
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*Failed Tests ({len(failed_tests)})*"}}
        )

        for key, result in failed_tests:
            # Guard against exceeding the 50-block limit; leave room for
            # the tested-documents section at the end.
            if len(blocks) >= _SLACK_MAX_BLOCKS - 2:
                blocks.append(
                    {"type": "section", "text": {"type": "mrkdwn", "text": "_... additional failures omitted (block limit reached)_"}}
                )
                break

            parts = key.split("::", 1)
            test_name = parts[1] if len(parts) > 1 else key
            error = result.get("error", "No error output captured.")
            checks = result.get("checks", [])

            detail_parts: list[str] = [f"*`{test_name}`*"]
            if checks:
                detail_parts.append("*Checks:*  " + ", ".join(checks))
            detail_parts.append(f"```{_truncate_tail(error)}```")

            blocks.append(
                {"type": "section", "text": {"type": "mrkdwn", "text": _truncate("\n".join(detail_parts))}}
            )

    # --- tested documents ---
    if tested_documents and len(blocks) < _SLACK_MAX_BLOCKS:
        blocks.append({"type": "divider"})
        doc_list = "\n".join(f"\u2022 `{d}`" for d in tested_documents)
        blocks.append(
            {"type": "section", "text": {"type": "mrkdwn", "text": _truncate(f"*Tested documents ({len(tested_documents)}):*\n{doc_list}")}}
        )

    # --- workflow run link ---
    if run_url and len(blocks) < _SLACK_MAX_BLOCKS:
        blocks.append(_run_url_block(run_url))

    return {"text": header_text, "blocks": blocks}


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
        payload = generate_slack_blocks(report, run_url=run_url)
        print(json.dumps(payload))
    else:
        summary = generate_summary(report)
        print(summary)

    return 0


if __name__ == "__main__":
    sys.exit(main())
