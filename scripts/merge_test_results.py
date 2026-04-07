#!/usr/bin/env python3
"""Merge multiple test-results.yaml files into a single unified report."""

import sys
from pathlib import Path

try:
    import yaml  # type: ignore[import-not-found]
except ModuleNotFoundError:
    print("PyYAML is required. Install it with: pip install pyyaml", file=sys.stderr)
    sys.exit(1)


def merge(input_dir: Path, output_path: Path) -> None:
    tested_documents: set[str] = set()
    tests: dict = {}
    total_documents: int = 0
    total_by_version: dict = {}

    result_files = sorted(input_dir.rglob("test-results.yaml"))
    for results_file in result_files:
        with open(results_file) as f:
            report = yaml.safe_load(f) or {}
        for doc in report.get("tested_documents", []):
            tested_documents.add(doc)
        for key, result in report.get("tests", {}).items():
            tests[key] = result
        # Take the max total_documents seen across shards (all shards scan the same glob)
        shard_total = report.get("total_documents", 0)
        if shard_total > total_documents:
            total_documents = shard_total
        for version, count in report.get("total_documents_by_version", {}).items():
            if count > total_by_version.get(version, 0):
                total_by_version[version] = count

    merged = {
        "tested_documents": sorted(tested_documents),
        "total_documents": total_documents,
        "total_documents_by_version": total_by_version,
        "tests": tests,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        yaml.safe_dump(merged, f, sort_keys=False)

    print(f"Merged {len(tests)} test result(s) from {len(result_files)} file(s)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input-dir> <output-file>", file=sys.stderr)
        sys.exit(1)
    merge(Path(sys.argv[1]), Path(sys.argv[2]))
