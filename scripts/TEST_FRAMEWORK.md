# Doc Test Framework

This framework generates and runs end-to-end tests directly from documentation markdown files. Tests are assembled from code blocks tagged with path selectors, chained across prerequisite files, and executed against a real Kubernetes cluster.

### Dependencies

Install yamltest and cloud-provider-kind to run the tests:

```bash
npm i -y -g yamltest@latest
pip3 install PyYAML
go install sigs.k8s.io/cloud-provider-kind@latest
```

---

## Where tests live

Doc tests for this site live in [solo-io/docs-tests](https://github.com/solo-io/docs-tests). The `latest` and `main` trees and `assets/agw-docs/` carry no test markup. Before each run, CI attaches the markup kept in docs-tests to a copy of the site. The markup syntax in this guide is the syntax you write in docs-tests.

| What | Where it lives | How to change it |
|---|---|---|
| Scenario definitions (what front matter `test:` declares) | `products/agentgateway/<kubernetes or standalone>/tests.yaml` in docs-tests | Edit `tests.yaml`. The format is described in the docs-tests README. |
| Code-block tags (`paths="..."`) and hidden `{{< doc-test >}}` checks | One annotation file per page under `products/agentgateway/annotations/` in docs-tests | In docs-tests, run `make annotate PAGE=<page> CONTENT_REPO=<path to this repo>`, edit the markup in the copy it writes to `out/annotate/`, then run `make save` with the same arguments. |

**Do not add `paths=` tags, `{{< doc-test >}}` blocks, or front matter `test:` to pages in this repo.** Every markup example in this guide is written in the `make annotate` copy in docs-tests.

- Older frozen version trees (such as `1.6.x`) still carry inline markup. It is ignored wherever docs-tests has an annotation for the page, and the daily refresh in docs-tests never copies a page's markup into the annotations. Do not edit that markup; make the change in docs-tests instead.
- When a content change needs a test change in docs-tests, push the test change to a docs-tests branch with the same name as the content PR's branch. The content PR's doc-tests run then uses that branch instead of docs-tests `main`, and the job summary says so. Merge the content PR here first, then the docs-tests PR.

---

## How it works

1. A scenario in docs-tests `tests.yaml` (or, in older frozen version trees, a `test:` block in a page's front matter) names a test and lists source files and path selectors — the pieces of shell and YAML to include.
2. `annotations.py` attaches the docs-tests annotations to a copy of the pages. `doc_test_run.py` then reads the scenarios, chains the sources together, and produces a standalone bash script.
3. The script is run inside a fresh `kind` cluster (with `cloud-provider-kind` for load balancer support).

---

## Path selectors

A **path** is a string label attached to a fenced code block or hidden command block. It controls which blocks are included in which test scenario. Write tags and hidden blocks in the `make annotate` copy of the page in docs-tests (see [Where tests live](#where-tests-live)), not on the page in this repo.

### Tagging visible code blocks

Add `,{paths="<name>}"` to the fenced code language line:

````md
```sh,{paths="install-httpbin"}
kubectl apply -f https://raw.githubusercontent.com/.../httpbin.yaml
```
````

A block may belong to multiple paths:

````md
```sh,{paths="standard,experimental"}
helm upgrade -i --create-namespace ...
```
````

Only `sh`/`bash`/`shell`/`yaml`/`yml` blocks are extracted.

### Tagging hidden command blocks

Use the `{{< doc-test >}}` Hugo shortcode for commands that must run during tests but must **not** appear in the website HTML (waits, retries, cleanup). The shortcode template outputs nothing, so the content is completely absent from rendered pages:

```md
{{< doc-test paths="install-httpbin" >}}
YAMLTest -f - <<'EOF'
- name: wait for httpbin deployment
  wait:
    ...
EOF
{{< /doc-test >}}
```

The `paths=` attribute works identically to fenced blocks.

---

## Front matter test metadata

> Scenarios for this site now live in docs-tests `tests.yaml` (see [Where tests live](#where-tests-live)). This section describes the front matter form, which the runner still reads in older frozen version trees. The `latest` and `main` trees have none. The `file`/`path` steps work the same way in both.

Do not add front matter `test:` to any page. On a page in an older tree that still has one, it lists named scenarios, each a list of `file`+`path` pairs. `file:` can use `${versionRoot}` (the page's version directory) or be omitted to mean the page itself.

### Typing scenarios

A scenario in `tests.yaml` declares a `type:`. A scenario without one is `functional`.

```yaml
scenarios:
  rewrite:
    type: functional
    needs: [install-experimental, gateway, httpbin]
    source: agw-docs/pages/traffic-management/transformations/rewrite.md
    path: rewrite
```

| Type | What it checks | Needs | Blocks the PR? |
|---|---|---|---|
| `schema` | The doc's own example CR validates against the real CRD's OpenAPI schema (renamed/removed/mistyped fields, wrong types) | Nothing — no cluster, no execution. See `doc_test_schema_check.py`. | Yes, in its own job (`schema-check`) |
| `functional` | Real behavior in a real cluster (apply config, assert on a real response) | A `kind` cluster, no vendor credentials | Yes |
| `live` | Same as functional, but a real external endpoint is reachable and returns the documented unauthenticated response (e.g. a JWKS discovery endpoint rejecting an unauthenticated request) | A real public endpoint, no credentials | Yes — runs in the same job as `functional` |
| `credentialed` | Full behavior against a real vendor with real credentials (e.g. a real OpenAI key) | Named secrets, provisioned out of band | No — runs on its own daily schedule via `--types credentialed`, `continue-on-error: true`, never on a PR |

`type:` also accepts a list, such as `type: [schema, functional]`. This produces two independent test cases, `rewrite::schema` and `rewrite::functional`, that share the same steps. `--test rewrite` selects both; `--test rewrite::schema` selects only the schema one. Add `schema` only when the scenario's final step is a custom resource with a local CRD schema (currently `AgentgatewayPolicy` and `AgentgatewayBackend`; see `doc_test_schema_check.py`). A plain Gateway API resource such as `HTTPRoute` has nothing to validate against, so it would only ever pass vacuously.

`doc_test_run.py --list-tests` and every generated report include each case's `type`. Filter what runs with `--types schema,functional,live` (comma-separated); omit it to run everything.

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
3. Identify which code blocks are relevant and what path label they carry (or add one in the page's annotation if missing).
4. Use the matching prerequisite in the scenario's `needs:` list in docs-tests `tests.yaml`. The common chain (install, gateway, sample app) is already defined under `prerequisites:` at the top of the file.

The extractor follows `{{< reuse "..." >}}` and internal links automatically, so you don't need to inline snippet contents — the scenario's `source:` names the reused file.

---

## Choosing the right path

- Use an **existing** path label if one already exists on the blocks you need.
- The path `all` is a conventional catch-all for blocks that are included in every scenario from that file.
- For tabbed content (Standard / Experimental installs), separate paths (`standard`, `experimental`) let you pick the right tab per scenario.
- A code block with **no** `paths=` is skipped by default (`skip_tabs_without_paths: true`).

### Adding a path to an existing block

If a block you need has no path, add one in the `make annotate` copy:

````md
```sh {paths="install-httpbin"}
kubectl apply -f ...
```
````

If the same block already belongs to another path and you need to add yours:

````md
```sh {paths="standard,my-new-path"}
...
```
````

---

## Waiting for resources with YAMLTest

Use `YAMLTest -f - <<'EOF' ... EOF` inside a `{{< doc-test >}}` shortcode block immediately after the `kubectl apply` it depends on. The `wait` test type polls a Kubernetes resource until a JSONPath condition is met.

### Wait for a Deployment to be ready

```md
{{< doc-test paths="all" >}}
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
{{< /doc-test >}}
```

### Wait for a Service to get a load balancer address and export it

```md
{{< doc-test paths="all" >}}
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
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
  setVars:
    INGRESS_GW_ADDRESS:
      value: true
EOF
{{< /doc-test >}}
```

`setVars` exports the `jsonPath`-matched value as an environment variable for downstream steps. It is a sibling of `wait:` (not nested inside it).

### Wait for an HTTPRoute condition

```md
{{< doc-test paths="install-httpbin" >}}
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
{{< /doc-test >}}
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
{{< doc-test paths="cors-in-httproute,cors-in-agentgatewaypolicy" >}}
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
{{< /doc-test >}}
```

- `source.type: local` sends the request from the local machine (default).
- Use `source.type: pod` with a pod selector to send the request from inside the cluster.
- The `headers` list under `expect` checks response headers (case-insensitive name matching).
- Use `retries:` on a test entry to retry on transient failures (e.g. a race condition where a response code flips briefly). **Do not use `retries:` to work around a new-hostname ECONNRESET** — see the Troubleshooting section.

---

## Running the tests

The scripts, scenarios, and annotations live in the `docs-tests` repo, not here (see
[Where tests live](#where-tests-live)). Run the `make` targets from this repo. They copy
the working tree, including uncommitted edits, to `out/doc-tests-tree`, attach the
annotations from your docs-tests clone to the copy, and run against it, so your pages are
never rewritten. Results and generated scripts are copied back to `out/tests/`.
`DOCS_TESTS_DIR` defaults to `../docs-tests`; set it if you cloned docs-tests elsewhere.

Do not call `doc_test_run.py --repo-root .` on this repo directly. Without the attach
step, the `latest` and `main` pages have no markup, so nothing runs.

### Generate scripts only (no cluster)

```sh
make test-generate DOCS_TESTS_DIR=<path to docs-tests>
```

Scripts are written to `out/tests/generated/`. `out/annotations/attach-report.json`
lists any markup that did not attach; scenarios that use it are skipped with a warning.

### Run all tests

Requires `kind` and `cloud-provider-kind` in PATH.

```sh
make test-run DOCS_TESTS_DIR=<path to docs-tests>
```

Each test scenario:
1. Creates a `kind` cluster named `doc-test-<scenario>`.
2. Starts `cloud-provider-kind` in the background (provides LoadBalancer IPs).
3. Runs the generated bash script from a scratch working directory, `out/tests/work/<scenario>/`.
4. Deletes the cluster.
5. Writes results to `out/tests/generated/test-results.yaml`.

### Where a test's files land

Guides write their config with relative paths (`cat <<EOF > config.yaml`), so the runner executes each script from `out/tests/work/<scenario>/` rather than from the repo root. Without this, every run drops config files into the working tree — 58 scenarios write a bare `config.yaml`, which is why `.gitignore` still carries an entry for it.

The directory is deleted and recreated per scenario, so a file left by an earlier run cannot mask a guide that forgets to write one. After a failure, the scratch files are still there to inspect, alongside the cluster diagnostics in `out/tests/generated/context/<scenario>/`.

This is also why a doc-test block must not read anything from the repo by relative path. Write what the test needs inside the script, the way the guides already do.

### Run a single test scenario

Pass runner options through `DOC_TESTS_ARGS`. `--file` takes the content page, not the
assets file:

```sh
# Run one specific scenario
make test-run DOCS_TESTS_DIR=<path> \
  DOC_TESTS_ARGS='--file content/docs/kubernetes/main/documentation/security/cors.md --test cors-in-httproute'

# Run all scenarios for a single page
make test-run DOCS_TESTS_DIR=<path> \
  DOC_TESTS_ARGS='--file content/docs/kubernetes/main/documentation/security/cors.md'

# Only generate the script, for inspection
make test-generate DOCS_TESTS_DIR=<path> \
  DOC_TESTS_ARGS='--file content/docs/kubernetes/main/documentation/security/cors.md --test cors-in-httproute'
```

To run a generated script by hand, run it from a scratch directory. Invoked from the repo
root, the script writes its config files into the working tree:

```sh
mkdir -p out/tests/work/manual && cd out/tests/work/manual
bash ../../generated/<script-name>.sh
```

### Key CLI options

| Flag | Default | Description |
|---|---|---|
| `--file` | — | Path to a single markdown file to generate/run tests for |
| `--test` | — | Name of a specific test scenario within `--file` |
| `--docs-glob` | `content/docs/**/*.md` | Glob to discover pages with `test:` metadata (ignored when `--file` is set) |
| `--product` | `kubernetes` | Context product used for `conditional-text` resolution |
| `--types` | all types | Comma-separated test types to run, e.g. `schema,functional,live`. See [Typing scenarios](#typing-scenarios) |
| `--docs-tests-root` | the docs-tests checkout the script runs from | docs-tests checkout to read the scenario manifests (`tests.yaml`) from (or `DOCS_TESTS_ROOT` env var). See [Where tests live](#where-tests-live) |
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
2. **Verify path labels** on all prerequisite code blocks; add `paths="..."` where missing, in the page's annotation (`make annotate` / `make save` in docs-tests).
3. **Add wait blocks** after each `kubectl apply` that creates something tests depend on.
4. **Export `INGRESS_GW_ADDRESS`** — it flows from `gateway.md` via `setVars`.
5. **Add the feature assertion** as a `{{< doc-test >}}` block in the feature page's annotation, never on the page itself.
6. **Add the scenario to docs-tests `tests.yaml`**, listing its prerequisites under `needs:` and the feature page's selector (see [Where tests live](#where-tests-live)).
7. **Regenerate** with `make test-generate`, confirm all of the markup attached, and inspect the script for unresolved shortcodes or missing commands.
8. **Run locally** with `make test-run DOC_TESTS_ARGS='--file <page> --test <scenario>'` to verify before opening the docs-tests PR. If it goes with a content PR, push it to a docs-tests branch with the same name as the content PR's branch.

---

## Displaying test status on doc pages

Doc pages with passing tests display a "Verified" badge below the page title.

### How it works

1. **Test results** are written to `out/tests/generated/test-results.yaml` after tests run.
2. **`doc_test_inject_status.py`** reads the results and adds a `test_status` field to each tested document's front matter:
   - `test_status: passed` — all tests for the page passed
   - `test_status: failed` — one or more tests failed (no badge displayed)
   - `test_status: partial` — no tests failed, but a scenario was skipped because its test annotations did not attach (no badge displayed)
3. **Hugo templates** check for `test_status: passed` and render a green "Verified" badge.

### Makefile targets

The Makefile provides convenient targets for working with test status:

| Target | Description |
|---|---|
| `make deps` | Install Python dependencies (PyYAML) |
| `make test-generate` | Generate doc test scripts without running them |
| `make test-run` | Run all doc tests |
| `make test-artifacts-fetch` | Fetch test artifacts from the latest main branch workflow run |
| `make test-status` | Inject test status into markdown files |
| `make fetch-test-artifacts-build` | Fetch artifacts, inject status, and build Hugo site |
| `make fetch-test-artifacts-serve` | Fetch artifacts, inject status, and serve Hugo site locally |
| `make test-run-build` | Run tests, inject status, and build Hugo site |
| `make test-run-serve` | Run tests, inject status, and serve Hugo site locally |

### Running locally

To preview the "Verified" badges locally:

```sh
# Option 1: Fetch results from CI and serve
make fetch-test-artifacts-serve

# Option 2: Run tests locally and serve
make test-run-serve
```

To manually inject test status after running tests:

```sh
make test-status
```

This updates the markdown files in `content/docs/` with the test status. The badge will appear when you run Hugo.

### Fetching test artifacts

The `test-artifacts-fetch` target downloads test results from the most recent completed workflow run on the `main` branch. This requires a `GITHUB_TOKEN` environment variable with `actions:read` scope:

```sh
export GITHUB_TOKEN=<your-token>
make test-artifacts-fetch
```

### CLI options for inject script

| Flag | Default | Description |
|---|---|---|
| `--repo-root` | `.` | Repository root directory |
| `--results-file` | `out/tests/generated/test-results.yaml` | Path to test results file |
| `--dry-run` | false | Preview changes without modifying files |
| `--quiet` | false | Suppress verbose output |

---

## Troubleshooting

If you run into issues with installing yamltest, include the `--force` flag.

On macOS, you might need to run either the `doc_test_run.py` command with `sudo`, or run `sudo cloud-provider-kind --gateway-channel=disabled` in a separate tab before running the tests. In macOS, the cloud-provider-kind tool to get a LoadBalancer IP requires elevated permissions.

### Common issues

**File paths differ between `latest` and `main`**

A `tests.yaml` scenario keyed by `source:` (an assets file) covers every version that reuses it, so this does not apply to it. It applies to older pages that still declare front matter `test:`: prefer `${versionRoot}/...` or an omitted `file:`, which resolve against the declaring page's version directory. A **literal** path (e.g. `content/docs/kubernetes/main/...`) must be updated when the page is copied to `latest`; otherwise the extractor pulls blocks from a different version's content, or fails silently if the file doesn't exist.

**Wrong prerequisite file paths**

The install prerequisite should point to `content/docs/kubernetes/<version>/documentation/quickstart/install.md`, not `content/docs/kubernetes/<version>/documentation/install/helm.md` or similar. Check the "Before you begin" section of the guide you're testing and follow the links to confirm the exact paths rather than guessing from memory.

**Test fails immediately with "kubectl port-forward" error**

Tests that contain `kubectl port-forward` in the generated script are automatically failed without running. Port-forwarding requires a persistent background process that doesn't work in the automated test environment. Replace any port-forward-based verification with a `YAMLTest` HTTP assertion using `${INGRESS_GW_ADDRESS}` instead.

The check skips comment-only lines, so a hidden `{{< doc-test >}}` block may name the command when explaining why a test avoids it. Trailing comments are still in scope — distinguishing a real `#` from one inside a quoted string or heredoc would need a shell parser, so the check over-reports rather than risk missing a real invocation. If a test is rejected and you cannot find the command, check for the phrase after a `#` on a line that also contains code.

**Wait assertions pass but HTTP test hangs then fails with `read ECONNRESET`**

When a test creates a new HTTPRoute with a hostname that was not previously registered, agentgateway-proxy (Rust/hyper) goes through two phases before it can serve the new route. `Accepted=True` and `ResolvedRefs=True` on the HTTPRoute only reflect control plane state (~50ms) — they do not guarantee the data plane is ready.

- **Phase 1 (~120s)**: Proxy is unaware of the new hostname; every connection is immediately reset (< 1ms). `curl --max-time 5` iterations cost ~2s each (instant failure + 2s sleep).
- **Phase 2 (last few seconds)**: Proxy receives xDS update and holds connections while applying it (4–26s per connection), then resets them.

Adding `retries: 3` alone (without a warmup loop) multiplies the Phase 2 hang — observed total: 4 × 107s ≈ 429s.

Fix: use **both** a curl warmup loop (covers Phase 1) and `retries: 1` on the first HTTP test entry (covers Phase 2):

```
{{< doc-test paths="<scenario-name>" >}}
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/get" -H "host: <new-hostname>" && break
  sleep 2
done
{{< /doc-test >}}
```

Then on the first YAMLTest HTTP assertion entry, add `retries: 1`. Once curl gets any HTTP response (even 404), Phase 1 is over. `retries: 1` absorbs Phase 2. Max poll window: ~420 seconds.

This only applies when the feature page creates an HTTPRoute with a **new hostname** not in the prereq chain. Tests that update an existing prereq-chain HTTPRoute (same name/namespace) are not affected.

**`read ECONNRESET` persists beyond the warmup window (cloud-provider-kind LB failure)**

If the test already has the warmup loop + `retries: 1` pattern but the HTTP assertion still fails with `read ECONNRESET` after 200+ seconds (the warmup curl loop never breaks out), the issue is likely a cloud-provider-kind LoadBalancer networking failure — not a data-plane warmup problem.

**How to distinguish from the data-plane warmup issue:** Check the controller logs in the diagnostic artifacts at `out/tests/generated/context/<scenario>/pods/<controller-pod>-controller-logs.log`. Look for `XDS: Pushing` entries with `clients:1` and `RDS` push responses for your routes:

```
{"msg":"XDS: Pushing","component":"krtxds","clients":1,"version":"..."}
{"msg":"push response","component":"krtxds","type":"RDS","resources":1,...}
```

If the controller pushed routes to the proxy successfully, the proxy IS configured — the problem is at the network level between the LB IP and the pod.

**Root cause:** cloud-provider-kind assigns a LoadBalancer IP to the Service, but traffic from that IP is not properly forwarded to the pod through the Kind Docker network. The LB IP is reachable (TCP connect succeeds) but the proxy resets the connection because it never receives the forwarded packets.

**Typical diagnostic evidence:**
- All pods Running with 0 restarts
- LB IP assigned (e.g. `172.18.0.x`) and Service shows `80:<nodePort>/TCP`
- HTTPRoutes show `Accepted=True`
- Controller logs show successful xDS pushes with `clients:1`
- Proxy log shows `started bind bind="80/agentgateway-system/agentgateway-proxy"`
- curl gets `ECONNRESET` for the entire test duration (200+ seconds)

**Resolution:** This is a transient infrastructure issue. Re-running the test typically resolves it. On macOS, ensure `cloud-provider-kind` has proper permissions (`sudo`). If it recurs frequently, check Docker resource allocation (memory/CPU) for the Kind cluster.

**`/expect: unknown property "bodyJsonPath"` errors**

This error almost always means the `expect` block has bad indentation. `bodyJsonPath` must be a direct child of `expect:`, not nested under `statusCode` or `headers`. Double-check that all keys under `expect:` are at the same indentation level:

```yaml
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.choices[0].message.content"
        comparator: contains
        value: "hello"
```

