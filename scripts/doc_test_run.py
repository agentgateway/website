#!/usr/bin/env python3

import argparse
import os
import re
import subprocess
import tempfile
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


def build_test_cases_from_file(
    repo_root: Path,
    md_file: Path,
    generated_dir: Path,
    filter_test_name: Optional[str] = None,
) -> Tuple[List[TestCase], List[str]]:
    """Build test cases from a single markdown file, optionally filtered to one test name."""
    test_cases: List[TestCase] = []
    tested_documents: List[str] = []

    if not md_file.is_file():
        return test_cases, tested_documents

    metadata = parse_front_matter(md_file)
    tests = metadata.get("test")
    if not isinstance(tests, dict) or not tests:
        return test_cases, tested_documents

    rel_doc = md_file.relative_to(repo_root).as_posix()
    tested_documents.append(rel_doc)

    doc_slug = sanitize_name(str(md_file.relative_to(repo_root).with_suffix("")))
    for test_name, entries in tests.items():
        if not isinstance(test_name, str) or not test_name:
            continue
        if filter_test_name and test_name != filter_test_name:
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


def build_test_cases(
    repo_root: Path,
    docs_glob: str,
    generated_dir: Path,
) -> Tuple[List[TestCase], List[str]]:
    test_cases: List[TestCase] = []
    tested_documents: List[str] = []

    for md_file in sorted(repo_root.glob(docs_glob)):
        cases, docs = build_test_cases_from_file(repo_root, md_file, generated_dir)
        test_cases.extend(cases)
        tested_documents.extend(docs)

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


def collect_cluster_context(cluster_name: str, context_dir: Path, verbose: bool) -> None:
    """Collect Kubernetes diagnostics from a kind cluster into context_dir.

    Mirrors the procgen server-status action: gathers pod logs, failed pods,
    events, nodes, CRDs, services, deployments, and helm values for every
    namespace, saving everything under context_dir/<category>/.

    Uses the kubeconfig exported from kind directly to avoid --context flag
    ordering issues with kubectl plugins/multi-resource commands.
    """
    # Export the kubeconfig for this cluster into a temp env var so we never
    # need --context anywhere (avoids "flags cannot be placed before plugin name").
    kubeconfig_result = subprocess.run(
        ["kind", "get", "kubeconfig", "--name", cluster_name],
        capture_output=True, text=True, timeout=30,
    )
    kubeconfig_content = kubeconfig_result.stdout
    kubeconfig_env = {**os.environ, "KUBECONFIG": ""}

    # Write kubeconfig to a temp file so subprocesses can share it
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as kf:
        kf.write(kubeconfig_content)
        kubeconfig_path = kf.name

    kubeconfig_env["KUBECONFIG"] = kubeconfig_path
    base_cmd = ["kubectl"]

    def run(args: List[str], out_file: Optional[Path] = None) -> str:
        cmd = base_cmd + args
        if verbose:
            print(f"  $ {' '.join(cmd)}")
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60, env=kubeconfig_env)
            output = result.stdout + result.stderr
        except Exception as exc:
            output = str(exc)
        if out_file:
            out_file.parent.mkdir(parents=True, exist_ok=True)
            out_file.write_text(output, encoding="utf-8")
        return output

    def run_raw(cmd: List[str], timeout: int = 30) -> subprocess.CompletedProcess:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=kubeconfig_env)

    try:
        print(f"\n--- Collecting cluster context for: {cluster_name} -> {context_dir} ---")
        context_dir.mkdir(parents=True, exist_ok=True)

        # Overview: pods, services, deployments across all namespaces (separate calls to avoid
        # the "flags before plugin name" error that comma-joined multi-resource gets can trigger)
        run(["get", "po", "-A"], context_dir / "pods.txt")
        run(["get", "svc", "-A"], context_dir / "services-overview.txt")
        run(["get", "deploy", "-A"], context_dir / "deployments-overview.txt")

        # Failed (non-Running) pods
        run(["get", "po", "-A", "--field-selector=status.phase!=Running", "-oyaml"],
            context_dir / "failed-pods.yaml")

        # Events sorted by time
        run(["get", "events", "-A", "--sort-by=.lastTimestamp"],
            context_dir / "events.txt")

        # Nodes
        nodes_dir = context_dir / "nodes"
        run(["get", "nodes", "-oyaml"], nodes_dir / "nodes.yaml")
        run(["describe", "nodes"], nodes_dir / "nodes-describe.log")

        # All custom resources — collect every CRD unconditionally
        crds_dir = context_dir / "crds"
        crd_list_output = run(["get", "crd", "--no-headers"])
        for line in crd_list_output.splitlines():
            parts = line.split()
            crd = parts[0] if parts else ""
            if not crd:
                continue
            run(["get", crd, "-A", "-oyaml"], crds_dir / f"{crd}.yaml")

        # Per-namespace pod logs, services, deployments, helm values
        ns_output = run_raw(
            base_cmd + ["get", "ns", "-o", "jsonpath={range .items[*]}{.metadata.name}{'\\n'}{end}"],
        )
        namespaces = [ns for ns in ns_output.stdout.splitlines() if ns.strip()]

        pods_dir = context_dir / "pods"
        svcs_dir = context_dir / "services"
        deploys_dir = context_dir / "deployments"
        helm_dir = context_dir / "helm-values"

        for ns in namespaces:
            # Pods
            pod_output = run_raw(
                base_cmd + ["-n", ns, "get", "po", "-o",
                            "jsonpath={range .items[*]}{.metadata.name}{'\\n'}{end}"],
            )
            for po in pod_output.stdout.splitlines():
                po = po.strip()
                if not po:
                    continue
                run(["-n", ns, "describe", "po", po], pods_dir / f"{ns}-{po}-describe.log")
                run(["-n", ns, "get", "po", po, "-oyaml"], pods_dir / f"{ns}-{po}-pod.yaml")
                # Container logs (previous then current)
                containers_out = run_raw(
                    base_cmd + ["-n", ns, "get", "po", po, "-o",
                                "jsonpath={range .spec.containers[*]}{.name}{'\\n'}{end}"],
                )
                for container in containers_out.stdout.splitlines():
                    container = container.strip()
                    if not container:
                        continue
                    prev = run_raw(base_cmd + ["-n", ns, "logs", "-p", "-c", container, po], timeout=60)
                    if prev.returncode == 0 and prev.stdout.strip():
                        log_text = prev.stdout
                    else:
                        curr = run_raw(base_cmd + ["-n", ns, "logs", "-c", container, po], timeout=60)
                        log_text = curr.stdout + curr.stderr
                    log_file = pods_dir / f"{ns}-{po}-{container}-logs.log"
                    log_file.parent.mkdir(parents=True, exist_ok=True)
                    log_file.write_text(log_text, encoding="utf-8")

            # Services
            svc_output = run_raw(
                base_cmd + ["-n", ns, "get", "svc", "-o",
                            "jsonpath={range .items[*]}{.metadata.name}{'\\n'}{end}"],
            )
            for svc in svc_output.stdout.splitlines():
                svc = svc.strip()
                if not svc:
                    continue
                run(["-n", ns, "describe", "svc", svc], svcs_dir / f"{ns}-{svc}-describe.log")
                run(["-n", ns, "get", "svc", svc, "-oyaml"], svcs_dir / f"{ns}-{svc}-svc.yaml")

            # Deployments
            deploy_output = run_raw(
                base_cmd + ["-n", ns, "get", "deploy", "-o",
                            "jsonpath={range .items[*]}{.metadata.name}{'\\n'}{end}"],
            )
            for deploy in deploy_output.stdout.splitlines():
                deploy = deploy.strip()
                if not deploy:
                    continue
                run(["-n", ns, "describe", "deploy", deploy], deploys_dir / f"{ns}-{deploy}-describe.log")
                run(["-n", ns, "get", "deploy", deploy, "-oyaml"], deploys_dir / f"{ns}-{deploy}-deploy.yaml")

            # Helm values
            helm_output = subprocess.run(
                ["helm", "list", "-n", ns, "-q"],
                capture_output=True, text=True, timeout=30, env=kubeconfig_env,
            )
            for chart in helm_output.stdout.splitlines():
                chart = chart.strip()
                if not chart:
                    continue
                helm_vals = subprocess.run(
                    ["helm", "get", "values", "-n", ns, chart, "-o", "yaml"],
                    capture_output=True, text=True, timeout=30, env=kubeconfig_env,
                )
                out_file = helm_dir / f"{ns}-{chart}.yaml"
                out_file.parent.mkdir(parents=True, exist_ok=True)
                out_file.write_text(helm_vals.stdout + helm_vals.stderr, encoding="utf-8")

        print(f"--- Context collection complete: {context_dir} ---\n")
    finally:
        os.unlink(kubeconfig_path)


def run_test_case(repo_root: Path, test_case: TestCase, cluster_prefix: str, verbose: bool, context_base_dir: Optional[Path] = None) -> Dict:
    test_slug = sanitize_name(test_case.name)
    cluster_name = f"{cluster_prefix}-{test_slug}"[:50]

    # Build a unique context dir slug from the full report key (doc_rel::test_name),
    # e.g. content/docs/kubernetes/main/security/csrf.md::default  ->
    #      content-docs-kubernetes-main-security-csrf--default
    # This avoids collisions when the same test name appears in multiple doc versions.
    doc_rel = test_case.document.relative_to(repo_root).as_posix()
    context_slug = sanitize_name(f"{doc_rel.removesuffix('.md')}--{test_case.name}")

    checks: List[str] = []
    status = "failed"
    error: Optional[str] = None
    collected_context_dir: Optional[Path] = None

    if verbose:
        print(f"\n=== Running test: {test_case.name} ({doc_rel}) ===")

    create_code, create_output = run_command(["kind", "create", "cluster", "--name", cluster_name], repo_root, verbose)
    if create_code != 0:
        # Best-effort context collection even if cluster creation partially failed
        if context_base_dir is not None:
            collected_context_dir = context_base_dir / context_slug
            collected_context_dir.mkdir(parents=True, exist_ok=True)
            (collected_context_dir / "test-execution.log").write_text(create_output, encoding="utf-8")
            try:
                collect_cluster_context(cluster_name, collected_context_dir, verbose)
            except Exception as exc:
                print(f"  [context collection skipped: {exc}]")
        return {
            "status": "failed",
            "checks": checks,
            "error": create_output.strip(),
            "cluster": cluster_name,
            **({"context_dir": str(collected_context_dir.relative_to(repo_root))} if collected_context_dir else {}),
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
            # Collect cluster diagnostics before the cluster is deleted
            if context_base_dir is not None:
                collected_context_dir = context_base_dir / context_slug
                collected_context_dir.mkdir(parents=True, exist_ok=True)
                (collected_context_dir / "test-execution.log").write_text(output, encoding="utf-8")
                try:
                    collect_cluster_context(cluster_name, collected_context_dir, verbose)
                except Exception as exc:
                    print(f"  [context collection error: {exc}]")
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
    if collected_context_dir is not None:
        result["context_dir"] = str(collected_context_dir.relative_to(repo_root))
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
    parser.add_argument("--file", nargs="+", default=None, metavar="FILE", help="Path(s) to one or more markdown files to test (relative to repo root or absolute)")
    parser.add_argument("--test", default=None, help="Name of a specific test scenario to run (only used when --file specifies a single file)")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    generated_dir = (repo_root / args.generated_dir).resolve()
    report_path = (repo_root / args.report_file).resolve()

    if args.file:
        filter_test_name = args.test if len(args.file) == 1 else None
        test_cases = []
        tested_docs: List[str] = []
        for f in args.file:
            md_file = Path(f)
            if not md_file.is_absolute():
                md_file = repo_root / md_file
            cases, docs = build_test_cases_from_file(repo_root, md_file, generated_dir, filter_test_name=filter_test_name)
            test_cases.extend(cases)
            tested_docs.extend(docs)
        tested_documents = sorted(set(tested_docs))
        if not test_cases:
            if args.test and len(args.file) == 1:
                print(f"No test named '{args.test}' found in {args.file[0]}")
            else:
                print(f"No test metadata found in the provided file(s).")
            return 1
    else:
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

    context_base_dir = generated_dir / "context"

    test_results: Dict[str, Dict] = {}
    exit_code = 0
    for test_case in test_cases:
        doc_rel = test_case.document.relative_to(repo_root).as_posix()
        key = f"{doc_rel}::{test_case.name}"
        result = run_test_case(repo_root, test_case, args.cluster_prefix, args.verbose, context_base_dir=context_base_dir)
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
