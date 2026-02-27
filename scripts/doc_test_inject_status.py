#!/usr/bin/env python3
"""
Inject test status metadata into markdown front matter based on test-results.yaml.

This script reads the test results file and updates the front matter of each
tested document with a `test_status` field indicating whether all tests passed.

Usage:
    python3 scripts/inject_test_status.py [--results-file PATH] [--dry-run]
"""

import argparse
import re
from pathlib import Path
from typing import Dict, List, Optional

try:
    import yaml
except ModuleNotFoundError:
    yaml = None


def load_test_results(results_path: Path) -> Dict:
    """Load test results from YAML file."""
    if yaml is None:
        raise RuntimeError("PyYAML is required. Install it with: pip install pyyaml")
    
    if not results_path.exists():
        print(f"Warning: Test results file not found: {results_path}")
        return {"tested_documents": [], "tests": {}}
    
    return yaml.safe_load(results_path.read_text(encoding="utf-8")) or {}


def compute_document_status(doc_path: str, tests: Dict) -> Optional[str]:
    """
    Compute the overall test status for a document.
    
    Returns:
        "passed" if all tests for this document passed
        "failed" if any test failed
        None if no tests exist for this document
    """
    doc_tests = {k: v for k, v in tests.items() if k.startswith(f"{doc_path}::")}
    
    if not doc_tests:
        return None
    
    all_passed = all(t.get("status") == "passed" for t in doc_tests.values())
    return "passed" if all_passed else "failed"


def parse_front_matter(content: str) -> tuple[Optional[str], Optional[Dict], str]:
    """
    Parse YAML front matter from markdown content.
    
    Returns:
        Tuple of (raw_front_matter, parsed_dict, body_content)
    """
    if yaml is None:
        raise RuntimeError("PyYAML is required. Install it with: pip install pyyaml")
    
    match = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
    if not match:
        return None, None, content
    
    raw_fm = match.group(1)
    body = content[match.end():]
    
    try:
        parsed = yaml.safe_load(raw_fm)
        if not isinstance(parsed, dict):
            parsed = {}
    except yaml.YAMLError:
        parsed = {}
    
    return raw_fm, parsed, body


def update_front_matter(content: str, test_status: Optional[str]) -> str:
    """
    Update the front matter with test_status field.
    
    If test_status is None, removes any existing test_status field.
    """
    if yaml is None:
        raise RuntimeError("PyYAML is required. Install it with: pip install pyyaml")
    
    raw_fm, parsed_fm, body = parse_front_matter(content)
    
    if raw_fm is None or parsed_fm is None:
        return content
    
    if test_status is None:
        if "test_status" in parsed_fm:
            del parsed_fm["test_status"]
    else:
        parsed_fm["test_status"] = test_status
    
    new_fm = yaml.safe_dump(parsed_fm, sort_keys=False, default_flow_style=False, allow_unicode=True, width=1000)
    new_fm = new_fm.rstrip("\n")
    
    return f"---\n{new_fm}\n---\n{body}"


def process_documents(
    repo_root: Path,
    results: Dict,
    dry_run: bool = False,
    verbose: bool = True
) -> Dict[str, str]:
    """
    Process all tested documents and update their front matter.
    
    Returns:
        Dict mapping document paths to their test status
    """
    tested_docs = results.get("tested_documents", [])
    tests = results.get("tests", {})
    
    status_map: Dict[str, str] = {}
    
    for doc_path in tested_docs:
        full_path = repo_root / doc_path
        
        if not full_path.exists():
            if verbose:
                print(f"Warning: Document not found: {doc_path}")
            continue
        
        status = compute_document_status(doc_path, tests)
        
        if status is None:
            if verbose:
                print(f"Skipping {doc_path}: no test results")
            continue
        
        status_map[doc_path] = status
        
        if verbose:
            icon = "✓" if status == "passed" else "✗"
            print(f"{icon} {doc_path}: {status}")
        
        if dry_run:
            continue
        
        content = full_path.read_text(encoding="utf-8")
        updated = update_front_matter(content, status)
        
        if content != updated:
            full_path.write_text(updated, encoding="utf-8")
    
    return status_map


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Inject test status metadata into markdown front matter."
    )
    parser.add_argument(
        "--repo-root",
        default=".",
        help="Repository root directory (default: current directory)"
    )
    parser.add_argument(
        "--results-file",
        default="out/tests/generated/test-results.yaml",
        help="Path to test results YAML file"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress verbose output"
    )
    args = parser.parse_args()
    
    if yaml is None:
        print("Error: PyYAML is required. Install it with: pip install pyyaml")
        return 1
    
    repo_root = Path(args.repo_root).resolve()
    results_path = repo_root / args.results_file
    
    if not results_path.exists():
        print(f"Results file not found: {results_path}")
        print("Skipping test status injection.")
        return 0
    
    if args.dry_run:
        print("=== DRY RUN MODE ===\n")
    
    results = load_test_results(results_path)
    status_map = process_documents(
        repo_root,
        results,
        dry_run=args.dry_run,
        verbose=not args.quiet
    )
    
    passed = sum(1 for s in status_map.values() if s == "passed")
    failed = sum(1 for s in status_map.values() if s == "failed")
    
    print(f"\nSummary: {len(status_map)} documents processed, {passed} passed, {failed} failed")
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
