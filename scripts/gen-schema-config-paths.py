#!/usr/bin/env python3
"""Generate data/schema_config_paths.json from the agentgateway config JSON Schema.

Run from the website repo root after schema changes (or wire into CI):

  python3 scripts/gen-schema-config-paths.py
  python3 scripts/gen-schema-config-paths.py path/to/config.json

Default source matches _content.gotmpl remote schema URL on main.
"""

import argparse
import json
import sys
import urllib.request


DEFAULT_URL = (
    "https://raw.githubusercontent.com/agentgateway/agentgateway/"
    "refs/heads/main/schema/config.json"
)


def load_schema(path_or_url: str) -> dict:
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        with urllib.request.urlopen(path_or_url) as r:
            return json.load(r)
    with open(path_or_url, encoding="utf-8") as f:
        return json.load(f)


def compute_paths_by_def(schema):
    defs = schema["$defs"]

    def resolve_all(node):
        if not isinstance(node, dict):
            return []
        if "$ref" in node:
            ref = node["$ref"]
            if ref.startswith("#/$defs/"):
                name = ref.split("/")[-1]
                d = defs.get(name)
                return [d] if d else []
            return []
        if "anyOf" in node or "oneOf" in node:
            out = []
            for b in (node.get("anyOf") or node.get("oneOf") or []):
                if isinstance(b, dict) and b.get("type") == "null":
                    continue
                out.extend(resolve_all(b))
            return out
        return [node]

    def ref_targets(node):
        out = []
        if not isinstance(node, dict):
            return out
        ref = node.get("$ref")
        if ref and ref.startswith("#/$defs/"):
            out.append(ref.rsplit("/", 1)[-1])
        for k in ("anyOf", "oneOf"):
            for b in node.get(k) or []:
                if isinstance(b, dict):
                    r = b.get("$ref")
                    if r and r.startswith("#/$defs/"):
                        out.append(r.rsplit("/", 1)[-1])
        return sorted(set(out))

    def is_array_schema(n):
        if not isinstance(n, dict) or "items" not in n:
            return False
        t = n.get("type")
        if t == "array":
            return True
        if isinstance(t, list) and "array" in t:
            return True
        return True

    def fmt_path(parts):
        out = []
        i = 0
        L = len(parts)
        while i < L:
            tok = parts[i]
            if tok == "[]":
                i += 1
                continue
            if i + 1 < L and parts[i + 1] == "[]":
                out.append(tok + "[]")
                i += 2
            else:
                out.append(tok)
                i += 1
        return ".".join(out)

    paths_by_def = {}

    def record(def_name, parts):
        paths_by_def.setdefault(def_name, set()).add(fmt_path(parts))

    def walk(node, parts, depth=0):
        if depth > 120 or len(parts) > 48:
            return
        for t in ref_targets(node):
            record(t, parts)
        for n in resolve_all(node):
            if not isinstance(n, dict):
                continue
            if is_array_schema(n):
                walk(n["items"], parts + ["[]"], depth + 1)
            elif "properties" in n:
                for pname, pschema in n["properties"].items():
                    saw_array = False
                    for sub in resolve_all(pschema):
                        if isinstance(sub, dict) and is_array_schema(sub):
                            walk(sub["items"], parts + [pname, "[]"], depth + 1)
                            saw_array = True
                    if not saw_array:
                        walk(pschema, parts + [pname], depth + 1)

    for tk, tv in schema.get("properties", {}).items():
        walk(tv, [tk])

    return {k: sorted(v) for k, v in sorted(paths_by_def.items())}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "schema",
        nargs="?",
        default=DEFAULT_URL,
        help="Path or URL to config.json (default: main branch raw GitHub URL)",
    )
    ap.add_argument(
        "-o",
        "--output",
        default="data/schema_config_paths.json",
        help="Output JSON path relative to cwd (default: data/schema_config_paths.json)",
    )
    args = ap.parse_args()

    schema = load_schema(args.schema)
    paths_by_def = compute_paths_by_def(schema)
    payload = {
        "generatedFrom": args.schema,
        "pathsByDef": paths_by_def,
    }
    out_path = args.output
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"Wrote {out_path} ({len(paths_by_def)} defs)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
