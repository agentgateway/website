#!/usr/bin/env python3

import argparse
import re
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import yaml  # type: ignore[import-not-found]
except ModuleNotFoundError:
    yaml = None

from doc_test_extract import Extractor


DEFAULT_OPTIONS = {
    "follow_reuse": True,
    "follow_include": True,
    "follow_internal_links": True,
    "skip_tabs_without_paths": True,
    "max_depth": 8,
}


@dataclass
class TestCase:
    document: Path
    name: str
    sources: List[Dict[str, str]]
    script_path: Path
    manifest_path: Path


def parse_front_matter(markdown_path: Path) -> Dict:
    if yaml is None:
        raise RuntimeError("PyYAML is required. Install it with: pip install pyyaml")

    text = markdown_path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not match:
        return {}
    front_matter = match.group(1)
    data = yaml.safe_load(front_matter) or {}
    if not isinstance(data, dict):
        return {}
    return data


def sanitize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def infer_version_from_sources(sources: List[Dict[str, str]], fallback: str) -> str:
    """Extract the link-version token (e.g. 'latest', 'main') from source file paths.

    Source files live under paths like:
      content/docs/kubernetes/latest/install/helm.md
      content/docs/kubernetes/main/security/cors.md

    The segment after the product directory (kubernetes/standalone) is the
    link version used inside {{< version include-if="..." >}} blocks.
    """
    pattern = re.compile(r"(?:kubernetes|standalone)/([^/]+)/")
    for src in sources:
        file_path = src.get("file", "")
        m = pattern.search(file_path)
        if m:
            return m.group(1)
    return fallback


def build_test_cases(
    repo_root: Path,
    docs_glob: str,
    generated_dir: Path,
) -> Tuple[List[TestCase], List[str]]:
    test_cases: List[TestCase] = []
    tested_documents: List[str] = []

    for md_file in sorted(repo_root.glob(docs_glob)):
        if not md_file.is_file():
            continue

        metadata = parse_front_matter(md_file)
        tests = metadata.get("test")
        if not isinstance(tests, dict) or not tests:
            continue

        rel_doc = md_file.relative_to(repo_root).as_posix()
        tested_documents.append(rel_doc)

        doc_slug = sanitize_name(str(md_file.relative_to(repo_root).with_suffix("")))
        for test_name, entries in tests.items():
            if not isinstance(test_name, str) or not test_name:
                continue
            if not isinstance(entries, list):
                continue

            sources: List[Dict[str, str]] = []
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                source_file = entry.get("file")
                source_path = entry.get("path")
                if not source_file or not source_path:
                    continue
                sources.append({"file": source_file, "path": source_path})

            if not sources:
                continue

            test_slug = sanitize_name(test_name)
            script_name = f"{doc_slug}-{test_slug}.sh"
            manifest_name = f"{doc_slug}-{test_slug}.manifest.json"

            test_cases.append(
                TestCase(
                    document=md_file,
                    name=test_name,
                    sources=sources,
                    script_path=generated_dir / script_name,
                    manifest_path=generated_dir / manifest_name,
                )
            )

    return test_cases, sorted(set(tested_documents))


def generate_script_and_manifest(repo_root: Path, definition: Dict, script_path: Path, manifest_path: Path) -> None:
    if yaml is None:
        raise RuntimeError("PyYAML is required. Install it with: pip install pyyaml")

    extractor = Extractor(repo_root=repo_root, definition=definition)
    extractor.walk()

    blocks = extractor.select_blocks()
    test_includes = extractor.select_test_includes()
    script = extractor.build_script(blocks, test_includes)
    manifest = extractor.build_manifest(blocks, test_includes)

    script_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text(script, encoding="utf-8")
    manifest_path.write_text(yaml.safe_dump(manifest, sort_keys=False), encoding="utf-8")


def run_command(command: List[str], cwd: Path, verbose: bool = True) -> Tuple[int, str]:
    if verbose:
        print(f"$ {' '.join(command)}")

    proc = subprocess.Popen(
        command,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    output_lines: List[str] = []
    if proc.stdout is not None:
        for line in proc.stdout:
            output_lines.append(line)
            if verbose:
                print(line, end="")

    return_code = proc.wait()
    return return_code, "".join(output_lines)


def run_test_case(repo_root: Path, test_case: TestCase, cluster_prefix: str, verbose: bool) -> Dict:
    test_slug = sanitize_name(test_case.name)
    cluster_name = f"{cluster_prefix}-{test_slug}"[:50]

    checks: List[str] = []
    status = "failed"
    error: Optional[str] = None

    if verbose:
        print(f"\n=== Running test: {test_case.name} ({test_case.document.relative_to(repo_root).as_posix()}) ===")

    create_code, create_output = run_command(["kind", "create", "cluster", "--name", cluster_name], repo_root, verbose)
    if create_code != 0:
        return {
            "status": "failed",
            "checks": checks,
            "error": create_output.strip(),
            "cluster": cluster_name,
        }

    cloud_provider = subprocess.Popen(
        ["cloud-provider-kind", "--gateway-channel", "disabled"],
        cwd=str(repo_root),
        stdout=None,
        stderr=None if verbose else subprocess.DEVNULL,
        text=True,
    )

    try:
        time.sleep(2)
        test_code, output = run_command(["bash", test_case.script_path.as_posix()], repo_root, verbose)
        checks = [line.strip() for line in output.splitlines() if line.strip().startswith("✓ ")]
        status = "passed" if test_code == 0 else "failed"
        if test_code != 0:
            error = output.strip()
    finally:
        cloud_provider.terminate()
        try:
            cloud_provider.wait(timeout=10)
        except subprocess.TimeoutExpired:
            cloud_provider.kill()

        delete_code, delete_output = run_command(["kind", "delete", "cluster", "--name", cluster_name], repo_root, verbose)
        if delete_code != 0 and not error:
            error = delete_output.strip()
            status = "failed"

    result = {
        "status": status,
        "checks": checks,
        "cluster": cluster_name,
    }
    if error:
        result["error"] = error
    return result


def write_report(report_path: Path, tested_documents: List[str], test_results: Dict[str, Dict]) -> None:
    if yaml is None:
        raise RuntimeError("PyYAML is required. Install it with: pip install pyyaml")

    report = {
        "tested_documents": tested_documents,
        "tests": test_results,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(yaml.safe_dump(report, sort_keys=False), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate and run doc tests from page YAML front matter metadata.")
    parser.add_argument("--repo-root", default=".", help="Workspace root")
    parser.add_argument("--docs-glob", default="content/docs/**/*.md", help="Glob to discover markdown docs")
    parser.add_argument("--version", default="2.2.x", help="Default context.version")
    parser.add_argument("--product", default="kubernetes", help="Default context.product")
    parser.add_argument(
        "--generated-dir",
        default="out/tests/generated",
        help="Directory where generated scripts/manifests are written",
    )
    parser.add_argument(
        "--report-file",
        default="out/tests/generated/test-results.yaml",
        help="YAML report file path",
    )
    parser.add_argument("--cluster-prefix", default="doc-test", help="Kind cluster name prefix")
    parser.add_argument(
        "--verbose",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Stream all command output (default: enabled)",
    )
    parser.add_argument("--generate-only", action="store_true", help="Only generate scripts/manifests, do not run tests")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    generated_dir = (repo_root / args.generated_dir).resolve()
    report_path = (repo_root / args.report_file).resolve()

    test_cases, tested_documents = build_test_cases(repo_root, args.docs_glob, generated_dir)
    if not test_cases:
        print("No docs with test metadata found.")
        write_report(report_path, tested_documents, {})
        return 0

    for test_case in test_cases:
        if args.verbose:
            print(f"Generating script for {test_case.document.relative_to(repo_root).as_posix()}::{test_case.name}")
        inferred_version = infer_version_from_sources(test_case.sources, args.version)
        definition = {
            "name": sanitize_name(f"{test_case.document.stem}-{test_case.name}"),
            "main_file": test_case.document.relative_to(repo_root).as_posix(),
            "context": {
                "version": inferred_version,
                "product": args.product,
            },
            "options": DEFAULT_OPTIONS,
            "sources": [{"file": src["file"], "paths": [src["path"]]} for src in test_case.sources],
            "output": {
                "script": test_case.script_path.relative_to(repo_root).as_posix(),
                "manifest": test_case.manifest_path.relative_to(repo_root).as_posix(),
            },
        }
        generate_script_and_manifest(repo_root, definition, test_case.script_path, test_case.manifest_path)

    if args.generate_only:
        write_report(report_path, tested_documents, {})
        print(f"Generated {len(test_cases)} scripts from metadata")
        print(f"Wrote report scaffold: {report_path.relative_to(repo_root)}")
        return 0

    test_results: Dict[str, Dict] = {}
    exit_code = 0
    for test_case in test_cases:
        doc_rel = test_case.document.relative_to(repo_root).as_posix()
        key = f"{doc_rel}::{test_case.name}"
        result = run_test_case(repo_root, test_case, args.cluster_prefix, args.verbose)
        test_results[key] = result
        if result.get("status") != "passed":
            exit_code = 1

    write_report(report_path, tested_documents, test_results)
    print("\n\n================= Test Results =================")
    print(f"Wrote report: {report_path.relative_to(repo_root)}")
    passed_count = sum(1 for r in test_results.values() if r['status'] == 'passed')
    failed_count = sum(1 for r in test_results.values() if r['status'] != 'passed')
    print(f"Test results: {len(test_cases)} total, {passed_count} passed, {failed_count} failed")
    if failed_count > 0:
        print("\nFailed test results:")
        print(yaml.safe_dump(test_results, sort_keys=False))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
