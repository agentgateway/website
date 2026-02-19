#!/usr/bin/env python3

import argparse
import json
import re
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


SHELL_LANGS = {"", "sh", "bash", "shell", "zsh", "yaml", "yml"}


@dataclass
class CodeBlock:
    file_path: Path
    start_line: int
    language: str
    paths: List[str]
    content: str
    hidden: bool = False


@dataclass
class TestInclude:
    file_path: Path
    start_line: int
    paths: List[str]
    test_file: Path


@dataclass
class FileResult:
    file_path: Path
    expanded_text: str
    code_blocks: List[CodeBlock] = field(default_factory=list)
    test_includes: List[TestInclude] = field(default_factory=list)
    links: List[str] = field(default_factory=list)


class Extractor:
    def __init__(self, repo_root: Path, definition: dict):
        self.repo_root = repo_root
        self.definition = definition
        options = definition.get("options", {})
        self.follow_reuse = bool(options.get("follow_reuse", True))
        self.follow_include = bool(options.get("follow_include", True))
        self.follow_internal_links = bool(options.get("follow_internal_links", True))
        self.max_depth = int(options.get("max_depth", 8))
        self.skip_tabs_without_paths = bool(options.get("skip_tabs_without_paths", True))
        self.version = definition.get("context", {}).get("version")
        self.product = definition.get("context", {}).get("product")

        self.sources = definition.get("sources", [])
        self.main_file = self._resolve_workspace_path(definition["main_file"])

        self.path_selectors_by_file: Dict[Path, Set[str]] = {}
        for source in self.sources:
            source_file = self._resolve_workspace_path(source["file"])
            selectors = set(source.get("paths", []))
            self.path_selectors_by_file[source_file] = selectors

        self.file_cache: Dict[Path, FileResult] = {}
        self.visited: Set[Path] = set()
        self.recursion_edges: List[Tuple[str, str, str]] = []

        self.all_markdown_files = [
            p
            for p in self.repo_root.rglob("*.md")
            if "/public/" not in p.as_posix() and "/resources/" not in p.as_posix()
        ]

    def _resolve_workspace_path(self, path_value: str) -> Path:
        path = Path(path_value)
        if path.is_absolute():
            return path.resolve()
        return (self.repo_root / path).resolve()

    def _read_file(self, path: Path) -> str:
        return path.read_text(encoding="utf-8")

    def _parse_shortcode_params(self, params: str) -> Dict[str, str]:
        return {m.group(1): m.group(2) for m in re.finditer(r'([\w-]+)="([^"]*)"', params)}

    def _evaluate_version_block(self, params: str) -> bool:
        if not self.version:
            return True
        kv = self._parse_shortcode_params(params)
        include_if = [x.strip() for x in kv.get("include-if", "").split(",") if x.strip()]
        exclude_if = [x.strip() for x in kv.get("exclude-if", "").split(",") if x.strip()]
        if include_if and self.version not in include_if:
            return False
        if exclude_if and self.version in exclude_if:
            return False
        return True

    def _strip_version_blocks(self, text: str) -> str:
        pattern = re.compile(r"\{\{[<%]\s*version\s*([^%>]*)[ \t]*[>%]\}\}(.*?)\{\{[<%]\s*/version\s*[>%]\}\}", re.DOTALL)

        def repl(match: re.Match) -> str:
            params = match.group(1) or ""
            body = match.group(2) or ""
            return body if self._evaluate_version_block(params) else ""

        return pattern.sub(repl, text)

    def _resolve_reuse(self, source_file: Path, asset_path: str, depth: int) -> str:
        if depth > self.max_depth:
            return ""
        trimmed = asset_path.lstrip("/")
        candidate = (self.repo_root / "assets" / trimmed).resolve()
        if not candidate.exists():
            return ""
        self.recursion_edges.append((source_file.as_posix(), candidate.as_posix(), "reuse"))
        return self._expand_text(candidate, self._read_file(candidate), depth + 1).rstrip("\n")

    def _resolve_include(self, source_file: Path, include_path: str, depth: int) -> str:
        if depth > self.max_depth:
            return ""
        rel = include_path.strip().strip("\"")
        rel = rel.strip("/")
        candidates = []
        include_candidate = self.repo_root / "content" / rel
        if include_candidate.suffix == ".md":
            candidates.append(include_candidate)
        else:
            candidates.extend([include_candidate.with_suffix(".md"), include_candidate / "_index.md"])

        for candidate in candidates:
            if candidate.exists():
                resolved = candidate.resolve()
                self.recursion_edges.append((source_file.as_posix(), resolved.as_posix(), "include"))
                return self._expand_text(resolved, self._read_file(resolved), depth + 1)
        return ""

    def _expand_text(self, source_file: Path, text: str, depth: int = 0) -> str:
        if depth > self.max_depth:
            return text

        text = self._strip_version_blocks(text)

        def replace_reuse(match: re.Match) -> str:
            shortcode = match.group(1)
            asset_path = match.group(2)
            if shortcode not in {"reuse", "reuse-append"} or not self.follow_reuse:
                return match.group(0)
            return self._resolve_reuse(source_file, asset_path, depth)

        text = re.sub(r"\{\{[<%]\s*(reuse|reuse-append)\s+\"([^\"]+)\"\s*[>%]\}\}", replace_reuse, text)

        def replace_include(match: re.Match) -> str:
            include_path = match.group(1)
            if not self.follow_include:
                return match.group(0)
            return self._resolve_include(source_file, include_path, depth)

        text = re.sub(r"\{\{[%<]\s*include\s+\"([^\"]+)\"\s*[%>]\}\}", replace_include, text)

        def replace_link_hextra(match: re.Match) -> str:
            return match.group(1)

        text = re.sub(r"\{\{<\s*link-hextra\s+path=\"([^\"]+)\"\s*>\}\}", replace_link_hextra, text)

        text = self._resolve_conditional_text_blocks(text)

        return text

    def _resolve_conditional_text_blocks(self, text: str) -> str:
        pattern = re.compile(
            r"\{\{[<%]\s*conditional-text\s*([^%>]*)[ \t]*[>%]\}\}(.*?)\{\{[<%]\s*/conditional-text\s*[>%]\}\}",
            re.DOTALL,
        )

        def repl(match: re.Match) -> str:
            params = self._parse_shortcode_params(match.group(1) or "")
            body = match.group(2) or ""
            include_if = [x.strip() for x in params.get("include-if", "").split(",") if x.strip()]
            exclude_if = [x.strip() for x in params.get("exclude-if", "").split(",") if x.strip()]

            if include_if:
                if not self.product:
                    return ""
                if self.product not in include_if:
                    return ""

            if exclude_if and self.product and self.product in exclude_if:
                return ""

            return body

        return pattern.sub(repl, text)

    def _extract_links(self, text: str) -> List[str]:
        found = []
        for match in re.finditer(r"\[[^\]]+\]\(([^)]+)\)", text):
            target = match.group(1).strip()
            if not target:
                continue
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            target = target.split("#", 1)[0]
            if target:
                found.append(target)
        return found

    def _find_by_route_like_target(self, target: str) -> Optional[Path]:
        stripped = target.strip().strip("/")
        if not stripped:
            return None

        direct_candidates = [
            self.repo_root / "content" / stripped,
            self.repo_root / "assets" / stripped,
            self.repo_root / "content" / f"{stripped}.md",
            self.repo_root / "assets" / f"{stripped}.md",
            self.repo_root / "content" / stripped / "_index.md",
            self.repo_root / "assets" / stripped / "_index.md",
            self.repo_root / "content" / "docs" / stripped / "_index.md",
            self.repo_root / "content" / "docs" / f"{stripped}.md",
            self.repo_root / "assets" / "agw-docs" / "pages" / f"{stripped}.md",
            self.repo_root / "assets" / "agw-docs" / "pages" / stripped / "_index.md",
        ]
        for candidate in direct_candidates:
            if candidate.exists():
                return candidate.resolve()

        last_segment = stripped.split("/")[-1]
        route_suffix = f"/{stripped}/"

        best: Optional[Path] = None
        best_score: Optional[int] = None
        for file_path in self.all_markdown_files:
            route_guess = self._route_for_file(file_path)
            if route_guess and route_guess.endswith(route_suffix):
                score = len(file_path.as_posix())
            elif file_path.stem == last_segment or (file_path.name == "_index.md" and file_path.parent.name == last_segment):
                score = len(file_path.as_posix()) + 1000
            else:
                continue

            if best is None or score < best_score:
                best = file_path.resolve()
                best_score = score

        return best

    def _route_for_file(self, file_path: Path) -> Optional[str]:
        p = file_path.resolve()
        if (self.repo_root / "content") in p.parents:
            rel = p.relative_to(self.repo_root / "content").as_posix()
            if rel.endswith("/_index.md"):
                rel = rel[: -len("/_index.md")]
            elif rel.endswith(".md"):
                rel = rel[: -len(".md")]
            return "/" + rel.strip("/") + "/"
        if (self.repo_root / "assets" / "agw-docs" / "pages") in p.parents:
            rel = p.relative_to(self.repo_root / "assets" / "agw-docs" / "pages").as_posix()
            if rel.endswith("/_index.md"):
                rel = rel[: -len("/_index.md")]
            elif rel.endswith(".md"):
                rel = rel[: -len(".md")]
            return "/" + rel.strip("/") + "/"
        return None

    def _extract_code_blocks(self, source_file: Path, text: str) -> List[CodeBlock]:
        blocks: List[CodeBlock] = []
        lines = text.splitlines()
        i = 0
        while i < len(lines):
            line = lines[i]
            open_match = re.match(r"^\s*(`{3,})(.*)$", line)
            if not open_match:
                i += 1
                continue

            fence = open_match.group(1)
            info = (open_match.group(2) or "").strip()
            start_line = i + 1
            lang = ""
            if info:
                lang = re.split(r"[,{\s]", info, maxsplit=1)[0].strip().lower()

            j = i + 1
            content_lines = []
            close_pattern = re.compile(rf"^\s*`{{{len(fence)},}}\s*$")
            while j < len(lines) and not close_pattern.match(lines[j]):
                content_lines.append(lines[j])
                j += 1

            attrs = info
            path_match = re.search(r'paths\s*=\s*"([^"]+)"', attrs)
            paths = []
            if path_match:
                paths = [x.strip() for x in path_match.group(1).split(",") if x.strip()]

            content = "\n".join(content_lines)
            content = textwrap.dedent(content).rstrip() + "\n"

            blocks.append(
                CodeBlock(
                    file_path=source_file,
                    start_line=start_line,
                    language=lang,
                    paths=paths,
                    content=content,
                )
            )

            i = j + 1 if j < len(lines) else j
        return blocks

    def _extract_hidden_shell_blocks(self, source_file: Path, text: str) -> List[CodeBlock]:
        blocks: List[CodeBlock] = []
        # Format: {{< doc-test paths="..." >}}\nBODY\n{{< /doc-test >}}
        # An empty shortcode template (layouts/shortcodes/doc-test.html) causes
        # Hugo to emit nothing for these blocks, keeping tests out of HTML output.
        pattern = re.compile(r"\{\{<\s*doc-test\b([^>]*?)>\}\}(.*?)\{\{<\s*/doc-test\s*>\}\}", re.DOTALL)

        for match in pattern.finditer(text):
            attrs = match.group(1) or ""
            body = match.group(2) or ""
            params = self._parse_shortcode_params(attrs)
            paths = [x.strip() for x in params.get("paths", "").split(",") if x.strip()]
            start_line = text[: match.start()].count("\n") + 1

            content = textwrap.dedent(body).strip("\n")
            if not content:
                continue

            blocks.append(
                CodeBlock(
                    file_path=source_file,
                    start_line=start_line,
                    language="sh",
                    paths=paths,
                    content=content + "\n",
                    hidden=True,
                )
            )

        return blocks

    def _extract_test_includes(self, source_file: Path, text: str) -> List[TestInclude]:
        includes: List[TestInclude] = []
        pattern = re.compile(r"<!--\s*doc-test-include\b([^>]*)-->")

        for match in pattern.finditer(text):
            attrs = match.group(1) or ""
            params = self._parse_shortcode_params(attrs)
            test_file_value = params.get("file")
            if not test_file_value:
                continue

            include_path = Path(test_file_value)
            test_file = include_path if include_path.is_absolute() else (source_file.parent / include_path)
            test_file = test_file.resolve()

            paths = [x.strip() for x in params.get("paths", "").split(",") if x.strip()]
            start_line = text[: match.start()].count("\n") + 1

            includes.append(
                TestInclude(
                    file_path=source_file,
                    start_line=start_line,
                    paths=paths,
                    test_file=test_file,
                )
            )

        return includes

    def process_file(self, file_path: Path, depth: int = 0) -> FileResult:
        file_path = file_path.resolve()
        if file_path in self.file_cache:
            return self.file_cache[file_path]

        raw = self._read_file(file_path)
        expanded = self._expand_text(file_path, raw, depth)
        code_blocks = self._extract_code_blocks(file_path, expanded)
        code_blocks.extend(self._extract_hidden_shell_blocks(file_path, expanded))
        test_includes = self._extract_test_includes(file_path, expanded)
        links = self._extract_links(expanded)

        result = FileResult(
            file_path=file_path,
            expanded_text=expanded,
            code_blocks=code_blocks,
            test_includes=test_includes,
            links=links,
        )
        self.file_cache[file_path] = result
        return result

    def walk(self) -> None:
        queue: List[Tuple[Path, int]] = [(self.main_file, 0)]
        for source_file in self.path_selectors_by_file:
            queue.append((source_file, 0))

        while queue:
            file_path, depth = queue.pop(0)
            file_path = file_path.resolve()
            if file_path in self.visited:
                continue
            if depth > self.max_depth:
                continue
            self.visited.add(file_path)

            result = self.process_file(file_path, depth)
            if not self.follow_internal_links:
                continue

            for link in result.links:
                linked = self._find_by_route_like_target(link)
                if linked and linked not in self.visited:
                    self.recursion_edges.append((file_path.as_posix(), linked.as_posix(), "link"))
                    queue.append((linked, depth + 1))

    def select_blocks(self) -> List[CodeBlock]:
        selected: List[CodeBlock] = []
        for source_file, selectors in self.path_selectors_by_file.items():
            result = self.file_cache.get(source_file.resolve())
            if not result:
                continue
            for block in result.code_blocks:
                if self.skip_tabs_without_paths and not block.paths:
                    continue
                if block.language not in SHELL_LANGS:
                    continue
                if selectors and set(block.paths).intersection(selectors):
                    selected.append(block)
        return selected

    def select_test_includes(self) -> List[TestInclude]:
        selected: List[TestInclude] = []
        for source_file, selectors in self.path_selectors_by_file.items():
            result = self.file_cache.get(source_file.resolve())
            if not result:
                continue
            for test_include in result.test_includes:
                if self.skip_tabs_without_paths and not test_include.paths:
                    continue
                if selectors and set(test_include.paths).intersection(selectors):
                    selected.append(test_include)
        return selected

    def build_script(self, blocks: List[CodeBlock], test_includes: List[TestInclude]) -> str:
        lines = ["#!/usr/bin/env bash", "set -euo pipefail", ""]
        seen = set()
        for block in blocks:
            content = block.content.strip("\n")
            if not content:
                continue
            if content in seen:
                continue
            seen.add(content)
            rel = block.file_path.relative_to(self.repo_root).as_posix()
            if block.hidden:
                lines.append(f"# Hidden source: {rel}:{block.start_line} paths={','.join(block.paths)}")
            else:
                lines.append(f"# Source: {rel}:{block.start_line} paths={','.join(block.paths)}")
            lines.append(content)
            lines.append("")

        seen_tests = set()
        for test_include in test_includes:
            rel_source = test_include.file_path.relative_to(self.repo_root).as_posix()
            rel_test = test_include.test_file.relative_to(self.repo_root).as_posix()
            if rel_test in seen_tests:
                continue
            seen_tests.add(rel_test)
            if not test_include.test_file.exists():
                raise FileNotFoundError(
                    f"doc-test-include file not found: {rel_test} (from {rel_source}:{test_include.start_line})"
                )
            lines.append(
                f"# Test include: {rel_source}:{test_include.start_line} paths={','.join(test_include.paths)} file={rel_test}"
            )
            lines.append(f"bun test {rel_test}")
            lines.append("")
        return "\n".join(lines).rstrip() + "\n"

    def build_manifest(self, blocks: List[CodeBlock], test_includes: List[TestInclude]) -> dict:
        discovered_paths_by_file = {}
        for path, result in self.file_cache.items():
            paths = sorted({p for b in result.code_blocks for p in b.paths} | {p for t in result.test_includes for p in t.paths})
            discovered_paths_by_file[path.relative_to(self.repo_root).as_posix()] = paths

        return {
            "name": self.definition.get("name"),
            "main_file": self.main_file.relative_to(self.repo_root).as_posix(),
            "sources": self.sources,
            "options": self.definition.get("options", {}),
            "context": self.definition.get("context", {}),
            "visited_files": sorted([p.relative_to(self.repo_root).as_posix() for p in self.visited]),
            "recursion_edges": [
                {
                    "from": Path(src).relative_to(self.repo_root).as_posix() if Path(src).is_absolute() else src,
                    "to": Path(dst).relative_to(self.repo_root).as_posix() if Path(dst).is_absolute() else dst,
                    "kind": kind,
                }
                for src, dst, kind in self.recursion_edges
            ],
            "discovered_paths_by_file": discovered_paths_by_file,
            "selected_blocks": [
                {
                    "file": b.file_path.relative_to(self.repo_root).as_posix(),
                    "line": b.start_line,
                    "language": b.language,
                    "paths": b.paths,
                    "hidden": b.hidden,
                    "preview": b.content.splitlines()[0] if b.content.splitlines() else "",
                }
                for b in blocks
            ],
            "selected_test_includes": [
                {
                    "file": t.file_path.relative_to(self.repo_root).as_posix(),
                    "line": t.start_line,
                    "paths": t.paths,
                    "test_file": t.test_file.relative_to(self.repo_root).as_posix(),
                }
                for t in test_includes
            ],
            "selected_count": len(blocks),
            "selected_test_count": len(test_includes),
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate executable doc test scripts from markdown path selectors.")
    parser.add_argument("--definition", required=True, help="Path to JSON test definition file")
    parser.add_argument("--repo-root", default=".", help="Workspace root")
    parser.add_argument("--output-script", help="Override output script path")
    parser.add_argument("--output-manifest", help="Override output manifest path")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    definition_path = (repo_root / args.definition).resolve() if not Path(args.definition).is_absolute() else Path(args.definition)

    definition = json.loads(definition_path.read_text(encoding="utf-8"))
    extractor = Extractor(repo_root=repo_root, definition=definition)
    extractor.walk()

    blocks = extractor.select_blocks()
    test_includes = extractor.select_test_includes()
    script = extractor.build_script(blocks, test_includes)
    manifest = extractor.build_manifest(blocks, test_includes)

    output_script = args.output_script or definition.get("output", {}).get("script")
    output_manifest = args.output_manifest or definition.get("output", {}).get("manifest")

    if not output_script or not output_manifest:
        raise ValueError("Definition must provide output.script and output.manifest, or pass CLI overrides")

    script_path = (repo_root / output_script).resolve()
    manifest_path = (repo_root / output_manifest).resolve()
    script_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    script_path.write_text(script, encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote script: {script_path.relative_to(repo_root)}")
    print(f"Wrote manifest: {manifest_path.relative_to(repo_root)}")
    print(f"Selected blocks: {len(blocks)}")
    print(f"Selected tests: {len(test_includes)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
