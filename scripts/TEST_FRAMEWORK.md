# Doc Test Framework

This framework generates and runs end-to-end tests directly from documentation markdown files. Tests are assembled from code blocks tagged with path selectors, chained across prerequisite files, and executed against a real Kubernetes cluster.

---

## How it works

1. A doc page declares a `test:` block in its YAML front matter, listing one or more named test scenarios.
2. Each scenario lists source files and path selectors — the pieces of shell/YAML to include.
3. `doc_test_run.py` reads this metadata, chains the sources together, and produces a standalone bash script.
4. The script is run inside a fresh `kind` cluster (with `cloud-provider-kind` for load balancer support).

---

## Path selectors

A **path** is a string label attached to a fenced code block or hidden command block. It controls which blocks are included in which test scenario.

### Tagging visible code blocks

Add `,paths="<name>"` to the fenced code language line:

````md
```sh,paths="install-httpbin"
kubectl apply -f https://raw.githubusercontent.com/.../httpbin.yaml
```
````

A block may belong to multiple paths:

````md
```sh,paths="standard,experimental"
helm upgrade -i --create-namespace ...
```
````

Only `sh`/`bash`/`shell`/`yaml`/`yml` blocks are extracted.

### Tagging hidden command blocks

Use HTML comment directives for commands that must run during tests but must **not** appear on the website (waits, retries, cleanup):

```md
<!-- doc-test paths="install-httpbin" -->
YAMLTest -f - <<'EOF'
- name: wait for httpbin deployment
  wait:
    ...
EOF
<!-- /doc-test -->
```

The `paths=` attribute works identically to fenced blocks.

---

## Front matter test metadata

On the page being tested, add a `test:` key to the YAML front matter. Each child key is a named test scenario. Each entry in the list is a `file`+`path` pair — a source file and the path selector to pull from it.

```yaml
---
title: CORS
test:
  cors-in-httproute:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/operations/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/security/cors.md
    path: cors-in-httproute

  cors-in-agentgatewaypolicy:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/operations/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/security/cors.md
    path: cors-in-agentgatewaypolicy
---
```

Multiple scenarios on the same page each get their own kind cluster and generated script.

---

## Tracing prerequisites

Every guide has a **Before you begin** section that lists prerequisites. Follow the chain from the feature guide back to the install guide:

```
feature page (e.g. cors.md)
  └── sample-app.md           (httpbin installed + HTTPRoute ready)
        └── gateway.md        (Gateway created + LB address exported)
              └── helm.md     (CRDs + controller installed)
```

For each hop:

1. Open the file and find its `## Before you begin` section.
2. Follow the linked page.
3. Identify which code blocks are relevant and what path label they carry (or add one if missing).
4. Add that file+path as a source entry above the current one in the `test:` front matter.

The extractor follows `{{< reuse "..." >}}` and internal links automatically, so you don't need to inline snippet contents — just reference the top-level content file.

---

## Choosing the right path

- Use an **existing** path label if one already exists on the blocks you need.
- The path `all` is a conventional catch-all for blocks that are included in every scenario from that file.
- For tabbed content (Standard / Experimental installs), separate paths (`standard`, `experimental`) let you pick the right tab per scenario.
- A code block with **no** `paths=` is skipped by default (`skip_tabs_without_paths: true`).

### Adding a path to an existing block

If a block you need has no path, add one:

````md
```sh,paths="install-httpbin"
kubectl apply -f ...
```
````

If the same block already belongs to another path and you need to add yours:

````md
```sh,paths="standard,my-new-path"
...
```
````

---

## Waiting for resources with YAMLTest

Use `YAMLTest -f - <<'EOF' ... EOF` inside a hidden `<!-- doc-test ... -->` block immediately after the `kubectl apply` it depends on. The `wait` test type polls a Kubernetes resource until a JSONPath condition is met.

### Wait for a Deployment to be ready

```md
<!-- doc-test paths="all" -->
YAMLTest -f - <<'EOF'
- name: wait for agentgateway-proxy deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
<!-- /doc-test -->
```

### Wait for a Service to get a load balancer address and export it

```md
<!-- doc-test paths="all" -->
YAMLTest -f - <<'EOF'
- name: wait for agentgateway-proxy service LB address
  wait:
    target:
      kind: Service
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
    jsonPath: "$.status.loadBalancer.ingress[0].ip"
    jsonPathExpectation:
      comparator: exists
    targetEnv: INGRESS_GW_ADDRESS
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
<!-- /doc-test -->
```

`targetEnv` exports the matched value as an environment variable for downstream steps.

### Wait for an HTTPRoute condition

```md
<!-- doc-test paths="install-httpbin" -->
YAMLTest -f - <<'EOF'
- name: wait for httpbin HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: httpbin
        name: httpbin
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
<!-- /doc-test -->
```

### Comparators

| Comparator | Meaning |
|---|---|
| `equals` | Exact string/number match |
| `greaterThan` | Numeric greater-than |
| `exists` | Field is present and non-empty |
| `contains` | String contains substring |

---

## Testing a feature with YAMLTest HTTP assertions

After all resources are ready and `INGRESS_GW_ADDRESS` is exported, add an HTTP test inside a hidden block on the feature page itself:

```md
<!-- doc-test paths="cors-in-httproute,cors-in-agentgatewaypolicy" -->
YAMLTest -f - <<'EOF'
- name: CORS preflight returns expected headers
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/get"
    method: OPTIONS
    headers:
      host: www.example.com
      Origin: https://example.com
  source:
    type: local
  expect:
    statusCode: 200
    headers:
      - name: access-control-allow-origin
        comparator: equals
        value: https://example.com
      - name: access-control-allow-methods
        comparator: contains
        value: GET
      - name: access-control-max-age
        comparator: equals
        value: "86400"
EOF
<!-- /doc-test -->
```

- `source.type: local` sends the request from the local machine (default).
- Use `source.type: pod` with a pod selector to send the request from inside the cluster.
- The `headers` list under `expect` checks response headers (case-insensitive name matching).
- Use `retries:` on a test entry to retry on failure.

---

## Running the tests

### Generate scripts only (no cluster)

```sh
python3 scripts/doc_test_run.py --generate-only
```

Scripts are written to `out/tests/generated/`.

### Run all tests

Requires `kind` and `cloud-provider-kind` in PATH.

```sh
python3 scripts/doc_test_run.py
```

Each test scenario:
1. Creates a `kind` cluster named `doc-test-<scenario>`.
2. Starts `cloud-provider-kind` in the background (provides LoadBalancer IPs).
3. Runs the generated bash script.
4. Deletes the cluster.
5. Writes results to `out/tests/generated/test-results.yaml`.

### Run a specific scenario by generating and executing its script directly

```sh
python3 scripts/doc_test_run.py --generate-only
bash out/tests/generated/<script-name>.sh
```

### Key CLI options

| Flag | Default | Description |
|---|---|---|
| `--docs-glob` | `content/docs/**/*.md` | Glob to discover pages with `test:` metadata |
| `--product` | `kubernetes` | Context product used for `conditional-text` resolution |
| `--generated-dir` | `out/tests/generated` | Output directory for scripts and manifests |
| `--generate-only` | false | Skip cluster creation and execution |
| `--verbose` | true | Stream all command output |

The `version` context (used to resolve `{{< version include-if="..." >}}` blocks) is inferred automatically from the source file paths — e.g. a source under `kubernetes/latest/` resolves to version token `latest`, and `kubernetes/main/` to `main`.

---

## Extractor rules

`doc_test_extract.py` processes source files before emitting the script:

- **`{{< reuse "..." >}}`** — inlined recursively from `assets/`.
- **`{{< version include-if="..." >}}`** — resolved against the inferred version token; non-matching blocks are dropped.
- **`{{< conditional-text include-if="..." >}}`** — resolved against the `product` context; non-matching blocks are dropped.
- **Indentation is stripped** from fenced block content so heredocs work correctly in bash.
- **Duplicate blocks** (same content) are emitted only once.
- Blocks without a `paths=` attribute are skipped.

---

## Checklist for adding a test to a new page

1. **Trace prerequisites** — follow "Before you begin" links back to `helm.md`.
2. **Verify path labels** on all prerequisite code blocks; add `paths="..."` where missing.
3. **Add wait blocks** after each `kubectl apply` that creates something tests depend on.
4. **Export `INGRESS_GW_ADDRESS`** — it flows from `gateway.md` via `targetEnv`.
5. **Add the feature assertion** as a hidden `<!-- doc-test ... -->` block on the feature page.
6. **Write the `test:` front matter** on the feature page, listing sources in dependency order (install → setup → prereqs → feature).
7. **Regenerate** with `--generate-only` and inspect the script for unresolved shortcodes or missing commands.
8. **Run locally** with `bash out/tests/generated/<script>.sh` against an existing cluster to verify before committing.
