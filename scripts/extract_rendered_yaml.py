#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "PyYAML",
# ]
# ///

import argparse
import json
import re
import sys
from collections import OrderedDict
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, Iterable, List

import yaml

IGNORED_EXACT_KEYS = {
    "apiVersion",
    "kind",
    "spec",
}

IGNORED_PREFIXES = (
    "metadata",
    "spec.targetRefs",
    "status",
)

IGNORED_REFERENCE_PATH_PARTS = {
    "api",
    "api-kubespec",
    "interactive-api",
}


class YamlCodeExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._capture_depth = 0
        self._buffer: List[str] = []
        self.snippets: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[tuple[str, str | None]]) -> None:
        if tag != "code":
            return

        attr_map = dict(attrs)
        class_names = set((attr_map.get("class") or "").split())
        data_lang = (attr_map.get("data-lang") or "").strip().lower()
        is_yaml = (
            "language-yaml" in class_names
            or "language-yml" in class_names
            or data_lang in {"yaml", "yml"}
        )
        if not is_yaml:
            return

        self._capture_depth = 1
        self._buffer = []

    def handle_endtag(self, tag: str) -> None:
        if tag != "code" or self._capture_depth == 0:
            return

        self._capture_depth -= 1
        if self._capture_depth != 0:
            return

        snippet = "".join(self._buffer).strip("\n")
        if snippet:
            self.snippets.append(snippet)
        self._buffer = []

    def handle_data(self, data: str) -> None:
        if self._capture_depth > 0:
            self._buffer.append(data)


def extract_yaml_from_html(html_text: str) -> List[str]:
    parser = YamlCodeExtractor()
    parser.feed(html_text)
    parser.close()
    return parser.snippets


def build_report_key(html_file: Path, input_dir: Path) -> str:
    for candidate in (input_dir, *input_dir.parents):
        if candidate.name != "public":
            continue
        return "/" + html_file.relative_to(candidate).as_posix()

    return html_file.relative_to(input_dir).as_posix()


def should_include_html_file(html_file: Path, input_dir: Path) -> bool:
    try:
        relative_parts = html_file.relative_to(input_dir).parts
    except ValueError:
        relative_parts = html_file.parts

    for index, part in enumerate(relative_parts):
        if part != "reference" or index + 1 >= len(relative_parts):
            continue
        if relative_parts[index + 1] in IGNORED_REFERENCE_PATH_PARTS:
            return False

    return True


def build_report(input_dir: Path) -> Dict[str, List[str]]:
    report: Dict[str, List[str]] = OrderedDict()
    for html_file in sorted(input_dir.rglob("*.html")):
        if not should_include_html_file(html_file, input_dir):
            continue
        snippets = extract_yaml_from_html(html_file.read_text(encoding="utf-8"))
        if not snippets:
            continue
        report[build_report_key(html_file, input_dir)] = snippets
    return report


def strip_heredoc_wrapper(snippet: str) -> str:
    lines = snippet.splitlines()
    if not lines:
        return snippet

    first_line = lines[0].strip()
    if "<<" not in first_line:
        return snippet

    match = re.search(r"<<-?\s*['\"]?([A-Za-z0-9_]+)['\"]?\s*$", first_line)
    if not match:
        return snippet

    marker = match.group(1)
    body_lines = lines[1:]
    if body_lines and body_lines[-1].strip() == marker:
        body_lines = body_lines[:-1]
    return "\n".join(body_lines).strip("\n")


def flatten_keys(value: Any, prefix: str = "") -> List[str]:
    keys: List[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str):
                continue
            path = f"{prefix}.{key}" if prefix else key
            keys.append(path)
            keys.extend(flatten_keys(child, path))
    elif isinstance(value, list):
        for item in value:
            keys.extend(flatten_keys(item, prefix))
    return keys


def should_include_key_path(path: str) -> bool:
    if path in IGNORED_EXACT_KEYS:
        return False

    for prefix in IGNORED_PREFIXES:
        if path == prefix or path.startswith(f"{prefix}."):
            return False

    return True


def iter_agentgateway_key_paths(snippet: str) -> Iterable[str]:
    normalized = strip_heredoc_wrapper(snippet)
    if not normalized.strip():
        return []

    found: List[str] = []
    try:
        documents = yaml.safe_load_all(normalized)
        for document in documents:
            if not isinstance(document, dict):
                continue
            kind = document.get("kind")
            if not isinstance(kind, str) or not kind.startswith("Agentgateway"):
                continue
            found.extend(flatten_keys(document))
    except yaml.YAMLError:
        return []
    return found


def build_agentgateway_key_report(input_dir: Path) -> Dict[str, List[str]]:
    report: Dict[str, List[str]] = OrderedDict()
    snippet_report = build_report(input_dir)
    for file_path, snippets in snippet_report.items():
        key_paths = sorted(
            {
                key
                for snippet in snippets
                for key in iter_agentgateway_key_paths(snippet)
                if should_include_key_path(key)
            }
        )
        if key_paths:
            report[file_path] = key_paths
    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract rendered YAML/YML code blocks from Hugo HTML output."
    )
    parser.add_argument(
        "--input-dir",
        default="public",
        help="Directory containing rendered HTML files",
    )
    parser.add_argument(
        "--output",
        default="-",
        help="Output JSON file path, or '-' for stdout",
    )
    parser.add_argument(
        "--agentgateway-keys",
        action="store_true",
        help="Emit flattened key paths for rendered YAML docs whose kind starts with 'Agentgateway'",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir).resolve()
    if not input_dir.exists():
        print(f"Input directory not found: {input_dir}", file=sys.stderr)
        return 1

    if args.agentgateway_keys:
        report = build_agentgateway_key_report(input_dir)
    else:
        report = build_report(input_dir)
    payload = json.dumps(report, indent=2) + "\n"

    if args.output == "-":
        sys.stdout.write(payload)
        return 0

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(payload, encoding="utf-8")
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
