---
name: doc-test-guides
description: Add executable doc tests to agentgateway documentation guides using the doc test framework. Use when the user asks to "add doc tests", "add tests to a guide", "add tests to a topic", mentions "YAMLTest", or is working on quickstart guides, standalone binary guides, or Kubernetes doc pages that should generate runnable scripts from code blocks.
version: 2.0.0
---

# Doc test guides skill

Use this skill when adding tests to documentation guides in the `agentgateway/website` repo so that code blocks and hidden steps are assembled into runnable scripts. The canonical reference is [scripts/TEST_FRAMEWORK.md](../../../scripts/TEST_FRAMEWORK.md). This skill summarizes the workflow and gotchas for **guides** (especially standalone/quickstart).

---

## Where tests live

Doc tests for this site live in [solo-io/docs-tests](https://github.com/solo-io/docs-tests), not in these pages. **Never add `paths=` tags, `{{< doc-test >}}` blocks, or front matter `test:` to a page in this repo.** The `latest` and `main` trees and `assets/agw-docs/` carry no test markup. CI attaches the markup kept in docs-tests to a copy of the pages before each run. The markup syntax in this skill is unchanged; only where you write it changed. See "Where tests live" in TEST_FRAMEWORK.md for details.

- **Scenarios** (name, prerequisites, path label): edit `products/agentgateway/<kubernetes or standalone>/tests.yaml` in docs-tests.
- **Code-block tags and hidden checks:** in docs-tests, run `make annotate PRODUCT=agentgateway PAGE=<page>`, edit the markup in the copy it writes to `out/annotate/<page>`, then run `make save` with the same arguments. Every markup example in this skill is written in that copy. Set `CONTENT_REPO=<path to this repo>` if this repo is not a sibling clone named `agentgateway-oss-website`.
- **Run** from this repo with `make test-generate` and `make test-run`, which attach your docs-tests annotations to a copy of the site first (see step 9).
- To test the docs-tests change in a content PR's own run, push it to a docs-tests branch with the **same name** as the content PR's branch. The PR's doc-tests workflow checks out that branch instead of docs-tests `main`, and says so in the job summary. Without a matching branch, the PR runs against `main`.
- Merge the content PR here first, then the docs-tests PR.
- Older frozen version trees (such as `1.6.x`) still carry inline markup. It is ignored wherever docs-tests has an annotation for the page, and the daily refresh in docs-tests never copies a page's markup into the annotations. Do not edit that markup; make the change in docs-tests instead.

---

## When to use

- Adding a new test scenario to a guide for the agentgateway standalone or agentgateway on Kubernetes open source docs.
- Planning which files to change and how to tag paths for a doc test.
- Debugging generated scripts (order, env vars, background processes).

---

## Core concepts

1. **Test scenarios** live in docs-tests `tests.yaml` (see [Where tests live](#where-tests-live)). The runner still reads front matter `test:` on older frozen version trees, but the `latest` and `main` trees have none. Do not add front matter scenarios.
2. **Path tags and hidden blocks** belong to the file that holds the code blocks, and are kept in that file's annotation in docs-tests. If the content page only has `{{< reuse "agw-docs/..." >}}`, the real body is in **assets**, so annotate the **asset** file (`make annotate PAGE=assets/agw-docs/...`), not the content wrapper.
   > **Critical**: Most Kubernetes topic pages (e.g. `content/docs/kubernetes/latest/resiliency/timeouts/request.md`) are thin wrappers that only contain `{{< reuse "agw-docs/pages/..." >}}`. **Always annotate the reuse file** (`assets/agw-docs/pages/...`), never the content wrapper. This way both `latest` and `main` versions automatically inherit the tests — you only need to add them once.
3. **Extractor** resolves `{{< reuse "..." >}}` from `assets/`, so the script is built from the expanded content. A `tests.yaml` scenario names the asset with `source:`, which covers every version that reuses it; `page:` is the fallback for a page with its own body.
4. **Block order**: Selected blocks are emitted in document order (by file and `start_line`). Hidden blocks (e.g. "start server in background") must appear *before* any visible block that depends on them (e.g. curl). The extractor sorts selected blocks by `(file_path, start_line)` so hidden blocks are not deferred to the end.
5. **Byte-identical blocks are silently dropped**: `build_script()` in `docs-tests/scripts/doc_test_extract.py` keeps a `seen` set of block contents and skips any block whose content (after stripping leading and trailing newlines) exactly matches an earlier selected block. Only the **first** copy reaches the generated script — there is no warning. See "Repeated commands across sections" under step 3 for what this breaks and how to avoid it.

---

## Workflow for adding a test to a guide

### 1. Identify content and asset files

- **Content file**: The doc page readers see (e.g. `content/docs/standalone/main/quickstart/llm.md`). Use it for `--file` when you run one page's tests.
- **Asset file(s)**: Where the guide body lives. If the content page is only `{{< reuse "agw-docs/standalone/quickstart/llm.md" >}}`, the asset is `assets/agw-docs/standalone/quickstart/llm.md`. This is the `PAGE` to annotate, and the `source:` of the scenario. **Never annotate the thin content wrapper** — the markup would only apply to that one version.

All markup in steps 3 to 8 goes in the `out/annotate/<page>` copy in docs-tests, never in this repo.

> **Note**: The `main` directory contains docs for the development version, while `latest` contains the current stable release. Tests can be added to either or both, depending on which version the feature is available in.

### 2. Trace prerequisites

- Follow the guide's **Before you begin** (or equivalent). For Kubernetes guides, chain back to install/setup (e.g. helm → gateway → sample-app → feature).
- For standalone guides there may be no doc prerequisites (e.g. "install the binary" is just a block on the same page).

### 3. Tag runnable blocks with paths

- Add `{paths="<name>"}` to the **info string** of every fenced block that should run in the test (e.g. ` ```sh {paths="llm"} `).
- Only `sh`/`bash`/`shell`/`yaml`/`yml` are extracted. Blocks without `paths=` are skipped when `skip_tabs_without_paths` is true.
- **Tabbed content**: Use different paths per tab (e.g. `{paths="httpbin,httpbin-linux"}` and `{paths="httpbin-macos"}`) so the scenario can pick one.
- **Multiple paths must be comma-separated** — both in fenced block info strings (`{paths="a,b"}`) and in `{{< doc-test paths="a,b" >}}` shortcodes. The extractor splits on `,`, so space-separated values (e.g. `paths="a b"`) are treated as a single path name and will never match — causing the block to be silently excluded from the generated script. This is especially dangerous for shared setup blocks (e.g. "install binary") that need to run for multiple scenarios.
- **Display-only YAML blocks**: Some pages show YAML configs as plain display blocks (no `cat <<'EOF'` shell wrapper), unlike LLM guides that wrap configs in shell commands. You can't tag a display-only YAML block with `paths=` because it isn't a runnable shell command. Instead, add a **hidden** `{{< doc-test >}}` block that writes the config with `cat <<'EOF' > config.yaml`. For an example, run `make annotate` on `content/docs/standalone/main/documentation/configuration/security/mcp-authz.md`.
- **External service dependencies**: When a config example depends on an external service that can't be trivially stood up in the test (e.g. Keycloak on port 9000, a custom OIDC provider), skip that example and only test self-contained ones. It's better to test one example well than to skip the entire page.

#### Repeated commands across sections

The extractor drops any block whose content is byte-identical to a block it already selected, keeping only the first. Nothing is logged, so the remaining copies just quietly do not run.

This bites on multi-section pages where each section repeats the same command. For example, a page with four sections that each write a config and then validate it:

```
{{< doc-test paths="my-test" >}}
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}
```

Four blocks like that collapse to **one**, so three of the four configs are never validated even though the test passes. The visible config-writing blocks survive because each one contains a different config.

Give each repeated block distinguishing content — a comment naming the section is enough, and it makes the generated script easier to read:

```
{{< doc-test paths="my-test" >}}
# Multi-level delegation: validate the config written by step 1
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}
```

To confirm nothing was dropped, count the commands in the generated script and compare against the source:

```sh
grep -c "validate-only" <docs-tests>/out/annotate/<page>.md   # the annotated copy
grep -c "validate-only" out/tests/generated/<script-name>.sh
```

The same trap applies to any repeated command, such as an identical `start_gateway`, `sleep 3`, or curl warmup loop used in more than one section.

### 4. Long-running processes (standalone binary)

- The guide may show "run agentgateway" in the foreground. For the generated script, the process must run in the background so the script can continue (e.g. curl, YAMLTest).
- Add a **hidden** `{{< doc-test paths="<name>" >}}` block that runs the server in the background and cleans up, e.g.:
  - `agentgateway -f config.yaml &`
  - `AGW_PID=$!`
  - `trap 'kill $AGW_PID 2>/dev/null' EXIT`
  - `sleep 3`
- Do **not** add a path to the visible "run agentgateway" block so it is not included in the script; only the hidden block is.
- **Helper backends: pick a port no documented config uses.** When a test needs a local backend to forward to, remember that doc tests run sequentially within a CI shard, so a helper process that outlives its script can collide with the next test. Port `8080` is the one documented configs use most (for example, the body-buffering page's `host: localhost:8080`), so choose something else (`8081`, `8082`) for a backend you invented, and keep the documented port for the test whose page actually specifies it.
- **Make readiness checks identity-aware.** A loop like `curl -sf http://127.0.0.1:8080/ && break` passes as soon as *anything* answers on that port, so a stale process from an earlier test satisfies it and the real assertion then fails for a misleading reason. Probe for a response only your backend produces, and fail with a clear message if it never appears:
  ```sh
  for i in $(seq 1 30); do
    [ "$(curl -sf --max-time 5 -X POST -d probe http://127.0.0.1:8080/ 2>/dev/null)" = "probe" ] && break
    sleep 1
  done
  if [ "$(curl -sf --max-time 5 -X POST -d probe http://127.0.0.1:8080/ 2>/dev/null)" != "probe" ]; then
    echo "FAIL: the echo backend did not come up on 127.0.0.1:8080 (is the port already in use?)"
    exit 1
  fi
  ```
- **Cleanup runs under `set -e`.** Generated scripts start with `set -euo pipefail`, so a failing command inside an `EXIT` trap aborts the handler and the script exits non-zero even when every assertion passed. Guard cleanup with `|| true`, and guard unset variables for `set -u`:
  ```sh
  stop_gateway() {
    [ -n "${AGW_PID:-}" ] || return 0
    kill "$AGW_PID" 2>/dev/null || true
    wait "$AGW_PID" 2>/dev/null || true
    AGW_PID=""
  }
  ```

#### Never start a background process inside `$( )`

A helper that both starts the gateway and returns a value looks convenient, but it breaks in two ways at once when it is called in a command substitution:

```sh
# BROKEN
tool_names_for() {
  agentgateway -f "$1" &
  AGW_PID=$!                 # set in the SUBSHELL, invisible to the caller
  curl ... | jq -r '...'
}
NAMES=$(tool_names_for config.yaml)
```

1. **The PID is lost.** `$( )` runs in a subshell, so `AGW_PID` never reaches the parent. A later `stop_gateway` sees it empty and returns without killing anything, so the gateway keeps holding its port. The next config then starts a gateway that cannot bind, and every assertion after that silently runs against the *previous* config.
2. **The gateway's output is captured.** The background process inherits the substituted stdout, so its startup log ends up concatenated into the returned value.

Symptom: the first assertion passes, later ones fail or hang for no obvious reason, and the test eventually times out. This is easy to misread as a product bug.

Split the two jobs, so the process starts in the parent shell and only pure-curl code runs inside `$( )`:

```sh
start_gateway() {                       # call from the parent, never inside $( )
  agentgateway -f "$1" > "agw-$1.log" 2>&1 &
  AGW_PID=$!
}

wait_for_tools() {                      # pure curl, safe inside $( )
  local out=""
  for i in $(seq 1 15); do
    out=$(query_something 2>/dev/null || true)
    [ -n "$out" ] && break
    sleep 2
  done
  echo "$out"
}

start_gateway config.yaml
NAMES=$(wait_for_tools)
stop_gateway
```

Redirect the process's output to a file as well, so nothing can leak into a captured value. When a page needs several configs in sequence, `stop_gateway` between them and confirm the port is actually released before the next start.

### 5. Env vars and placeholders

- **Shell-safe placeholders**: Unquoted `<placeholder>` can be interpreted as redirection. Use quotes or a default, e.g. `export OPENAI_API_KEY='<your-api-key>'` or `export OPENAI_API_KEY="${OPENAI_API_KEY:-<your-api-key>}"`.
- **Optional real value**: Use `"${VAR:-placeholder}"` so the test can pass when the var is set (e.g. in CI or user's shell) and still run with a placeholder when not set.

### 6. Add the test scenario

Add the scenario to docs-tests `products/agentgateway/<kubernetes or standalone>/tests.yaml`, under `scenarios:`:

```yaml
scenarios:
  <scenario-name>:
    type: functional
    needs: [install-standard, gateway, httpbin]   # prerequisites defined at the top of the file
    source: agw-docs/pages/<path>.md              # the asset file; covers latest and main
    path: <path-name>
```

- `needs:` names prerequisites defined once under `prerequisites:` at the top of the file. Take them from the guide's actual **Before you begin** links, in dependency order. Add a new prerequisite only when no existing one fits.
- Use `page:` (a version-root-relative content path) instead of `source:` only for a page that has its own body and no single reuse source.
- `before:` lists extra steps from other pages that run after `needs:` and before this page, for example a sample app the page assumes.
- One scenario can list only the page itself if the guide is self-contained.
- Set `name:` when two pages in one mode declare the same scenario name. Scenario keys must be unique per mode.

**Pages with no testable content** (no code blocks, landing pages, concept pages, `_index.md` files without ordered steps, etc.) are listed under the `skip:` key of docs-tests `tests.yaml` instead of getting a scenario. This counts the page as covered in the test coverage report without generating any test cases. A `dir:` entry covers every page under a folder, for generated pages such as the agctl reference:

```yaml
skip:
- page: documentation/about/_index.md
- dir: reference/agctl/
```

This replaces front matter `test: skip`. Do not add `test: skip` to pages.

**Before adding a page to `skip:`, consider whether the content could become testable.** The table below summarizes what it would take for each category of "non-runnable" content. If the effort is low (content-only changes), prefer making the page testable over skipping it.

| Content type | Why it seems non-runnable | Path to testable | Change needed |
|---|---|---|---|
| Display-only YAML configs with placeholders (e.g. Auth0, provider configs) | YAML blocks aren't shell commands, placeholders reference external services | Add hidden `{{< doc-test >}}` blocks that write self-contained configs via `cat <<'EOF' > config.yaml`, start the server, and validate with `agentgateway --validate` or a YAMLTest health check. Skip examples that require real external services (IdPs, cloud APIs) and test only the self-contained subset | Content only |
| Client config snippets (e.g. Claude Desktop JSON, VS Code settings) | Can't run the client in CI | Add hidden blocks that write the JSON to a file and validate syntax with `jq . config.json`. Catches typos and structural errors without proving the integration works end-to-end | Content only |
| Conceptual/about pages (pure prose, no code) | No code to run | Add a minimal "try it" example at the bottom that demonstrates the concept with a working config + assertion. This is a content strategy decision — if the page's purpose is purely explanatory, a `skip:` entry is appropriate | Content decision |
| Index/hub pages (`_index.md` with card links) | No code, only navigation | These legitimately belong under `skip:`. The only possible validation is confirming card link targets exist, which would be a separate link-checking CI job (not a doc test) | Script change (separate job) |

**Key principle:** The existing framework already supports every content type except pure link validation. Most "non-runnable" pages can become testable through content changes alone — adding hidden `{{< doc-test >}}` blocks that write configs, start services in the background, and run lightweight assertions. 

### 7. Optional: YAMLTest assertions

- For HTTP checks (e.g. "GET returns 200"), add a hidden `{{< doc-test paths="<name>" >}}` block with a YAMLTest snippet:
  - `YAMLTest -f - <<'EOF'` and a test entry with `http:` and `expect:`.
- Place it after the block that starts the server (so after the hidden "start in background" block in the doc).
- Supported `expect:` properties (all are direct children of `expect:`, at the same indentation level):
  - `statusCode: <number>` — assert HTTP response status code
  - `headers:` — list of `{name, comparator, value}` entries for response header assertions (case-insensitive)
  - `bodyJsonPath:` — list of `{path, comparator, value}` entries using JSONPath expressions against the response body

Example with all three:

```yaml
  expect:
    statusCode: 200
    headers:
      - name: content-type
        comparator: contains
        value: application/json
    bodyJsonPath:
      - path: "$.choices[0].message.content"
        comparator: contains
        value: "hello"
```

> **Do not use `jsonPath`** — the correct property name is `bodyJsonPath`. Using `jsonPath` causes `/expect: unknown property "jsonPath"` schema validation errors.

#### MCP endpoint testing

MCP uses JSON-RPC over HTTP, so YAMLTest works for MCP endpoints, but the request format differs from REST. To test that an MCP endpoint is up and accepting connections, send an `initialize` request:

```yaml
YAMLTest -f - <<'EOF'
- name: MCP endpoint accepts initialize request
  http:
    url: "http://localhost:3000"
    path: /mcp
    method: POST
    headers:
      content-type: application/json
      accept: "application/json, text/event-stream"
    body: |
      {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
  source:
    type: local
  expect:
    statusCode: 200
EOF
```

For deeper assertions (e.g. verifying `tools/list` returns only authorized tools), you would need to capture the `mcp-session-id` from the initialize response and pass it as a header in subsequent requests. The authorization tutorial (`content/docs/standalone/main/tutorials/authorization/_index.md`) shows the full curl-based MCP session flow.

- For Kubernetes tests, use `${INGRESS_GW_ADDRESS}` as the host in the URL (e.g. `url: "http://${INGRESS_GW_ADDRESS}:80/get"`). **Never use `kubectl port-forward`** in visible blocks — tests containing `kubectl port-forward` are automatically failed without running.
- **Host headers must not include a port** — use `host: "example.com"`, not `host: "example.com:80"`. The gateway's hostname matching is strict: including the port causes no route match, and agentgateway resets the TCP connection (`ECONNRESET`) rather than returning an HTTP error response.
- **Response body CEL expressions require uncompressed responses.** YAMLTest uses axios, which sends `Accept-Encoding: gzip, deflate, br` by default. If a test asserts on a response header computed from a `json(response.body)` CEL expression (e.g. `string(json(response.body).model)`), the upstream may return a compressed body that agentgateway cannot parse, causing the CEL expression to fail silently and the header to never be set. Fix by adding `accept-encoding: identity` to the YAMLTest `http.headers` to force an uncompressed response. This only affects test requests — `curl` and most API clients do not request compression by default, so user-facing examples work without the header.

#### Data plane warmup for new hostnames

When a test creates a new HTTPRoute with a hostname that was not previously registered (e.g. `match.example`), agentgateway-proxy (a Rust/hyper proxy, not Envoy) goes through two distinct phases before it can serve the new route. Kubernetes resource wait assertions (`Accepted=True`, `ResolvedRefs=True`) only reflect **control plane** state and pass in ~50ms — they do **not** guarantee the data plane has applied the new config yet.

**Two-phase proxy behavior:**

- **Phase 1 (~120s)**: The proxy is not yet aware of the new hostname. Every connection is immediately reset (`ECONNRESET` in < 1ms). Because the reset is instant (not a timeout), `curl --max-time 5` iterations each cost ~2s (immediate failure + 2s sleep). 60 iterations × 2s = 120s max for this phase.
- **Phase 2 (last few seconds)**: The proxy receives the xDS config update and holds incoming connections while applying it (due to `header_read_timeout = 10 minutes`). Each connection hangs 4–26s before being reset. This is brief but can still fail a YAMLTest entry.
- **Phase 3**: Proxy serves the route normally.

**Symptom**: Wait assertions pass in under a second. The curl warmup loop runs for ~2 minutes (Phase 1), then the first YAMLTest HTTP entry hangs 4–26s and fails with `read ECONNRESET` (Phase 2). Adding `retries: 3` (without a warmup loop) makes Phase 2 far worse — each retry hangs for the full duration (observed: 4 × 107s ≈ 429s).

**Fix**: Use **both** a curl warmup loop (covers Phase 1) and `retries: 1` on the first HTTP test entry (covers Phase 2):

```
{{< doc-test paths="<scenario-name>" >}}
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/get" -H "host: <new-hostname>" && break
  sleep 2
done
{{< /doc-test >}}

{{< doc-test paths="<scenario-name>" >}}
YAMLTest -f - <<'EOF'
- name: <scenario> - first HTTP assertion
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /get
    method: GET
    headers:
      host: "<new-hostname>"
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}
```

The curl loop exits as soon as the proxy returns any HTTP response (even 404) — that signals Phase 1 is over. `retries: 1` on the YAMLTest entry absorbs the Phase 2 hold (one retry after a 4–26s hang). Do **not** use `retries: 3` or higher without the warmup loop — it amplifies the total wait time dramatically.

**When this applies**: Any test that creates an HTTPRoute with a hostname not already registered in the proxy. Tests that *update* or *replace* an existing HTTPRoute from the prereq chain (same name, same namespace) don't trigger this — the virtual host is already wired up.

**How to spot it in advance**: Compare the HTTPRoute `name` in the feature page's `kubectl apply` blocks vs. the HTTPRoute names created in the prereq chain. If the feature creates a new name (e.g. `httpbin-match` for `match.example`) that isn't in the prereqs, add the warmup loop + `retries: 1`. If it overwrites an existing prereq-chain HTTPRoute (same name), skip it.

- For cleanup blocks tagged with a specific path, add `--ignore-not-found` to `kubectl delete` commands **only when the page has multiple test scenarios** and the cleanup block is shared across them (tagged with multiple paths like `paths="scenario-a,scenario-b"`). In that case, a single scenario may only create a subset of the resources the cleanup tries to delete. When a page has only one test scenario, `--ignore-not-found` is unnecessary because every resource in the cleanup was created by that scenario.

### 8. Validate YAML code blocks

Before generating, review any `yaml`/`yml` fenced blocks tagged with `paths=` to catch indentation bugs that cause silent misconfigurations:

- **List items under a mapping key**: `- item:` followed by `- child:` at the same dash column means `child` is a sibling, not a child. Indent `- child:` 2 more spaces to nest it properly.
- **Common hotspot**: `rules[].filters` in HTTPRoute specs. A misindented `- type: RequestRedirect` becomes a second rule instead of a filter entry, resulting in a route with no filter and no backend — the gateway resets the connection (`ECONNRESET`) instead of returning the expected HTTP response.
- **Quick check**: For any `key:\n  - subkey:` pattern, verify the `-` of the list item is indented at least 2 spaces past the start of `key`.

### 9. Generate and verify

Run from this repo. The targets copy the working tree to `out/doc-tests-tree`, attach the annotations from your docs-tests clone to the copy, and run against it, so your pages are never rewritten. `DOCS_TESTS_DIR` defaults to `../docs-tests`.

- Generate: `make test-generate DOCS_TESTS_DIR=<path to docs-tests>`. Add `DOC_TESTS_ARGS='--file <content page>'` for one page, plus `--test <scenario>` for one scenario.
- Check `out/annotations/attach-report.json`, or the attach summary line: every piece of your markup must attach. Markup that does not attach makes its scenarios skip with a warning.
- Do **not** call `doc_test_run.py --repo-root .` directly. Without the attach step, the `latest` and `main` pages have no markup, so nothing runs.
- Inspect `out/tests/generated/*.sh`: order of steps, no unresolved shortcodes, env vars and backgrounding correct.
- Run a script manually, e.g. `bash out/tests/generated/<script-name>.sh` (standalone tests do not use a kind cluster; use `--generate-only` and run the script in an env that has the binary/Docker/etc.).

### 10. Report what is tested and what is not (required)

Every time you add or update a doc test, produce a **coverage summary** for the page: a list of what the test validates from the visible content, and a list of what it does **not** validate, each with a one-line reason. This makes coverage gaps explicit instead of letting a passing test imply the whole page is covered.

Do this in **two places**:

1. **In the test**, as a `{{< doc-test >}}` comment block at the top of the test's hidden setup, in the annotation (it is never rendered on the page). Keep it current when you change assertions. Example shape:
   ```
   {{< doc-test paths="<scenario>" >}}
   # WHAT THIS TEST VALIDATES:
   #   * <thing> — <which content block / panel / endpoint it covers>
   # WHAT THIS TEST DOES NOT VALIDATE (and why):
   #   * <thing> — <reason: UI-only step / external dependency not stood up /
   #     requires traffic or config this page does not include / display-only example / etc.>
   {{< /doc-test >}}
   ```
2. **To the user**, as a short two-list summary in your reply.

Write each "not tested" reason from a fixed set of causes so the gap is actionable:
- **UI-only step** — the doc instructs clicking through a web UI (no scriptable equivalent), so the test uses an API call as a proxy or skips it.
- **Display-only block** — the block is illustrative (PromQL query, a `version: '3'` compose file) and isn't a self-contained runnable command.
- **External dependency** — needs a service the test can't stand up (real IdP, cloud API, LLM provider key).
- **Requires config/traffic the page omits** — the metric/log/trace only appears with setup that lives on a different page (e.g. a tracing policy, an OTLP access-log policy, LLM/MCP traffic).
- **Different layer** — e.g. backend pod readiness is checked but not that data is actually stored; the asserted metric exists but the dashboard panel's render isn't verified.

Base both lists on what you actually confirmed on a run, not on what you intended to cover. If an assertion was dropped because it failed (and the failure is a content/product gap, not a test bug), it belongs in "not tested" with the reason — see step 11.

### 11. When a test fails: fix the test or fix the content?

When a test fails, determine **where the bug lives** before changing anything. There are two distinct cases:

#### Case 1: Test bug, content is correct

The hidden `{{< doc-test >}}` block has a mistake — wrong assertion, missing retry, bad YAMLTest schema property, missing env var setup — but the visible documentation accurately describes what the product does. **Fix only the test**, in docs-tests. The customer-facing content stays as-is.

Examples:
- YAMLTest `wait.target` includes an unsupported property like `apiVersion` → remove the invalid property from the hidden block.
- A shell variable (e.g. `ANTHROPIC_API_KEY`) is referenced in a tagged block but set in an untagged visible block → add a hidden `{{< doc-test >}}` block that exports the variable with a placeholder default.
- A config_dump assertion needs more retries because the data plane takes time to propagate → increase `retries` in the hidden block.

#### Case 2: Content bug, test is revealing it

The visible documentation — `kubectl apply` blocks, example output, curl commands, or explanatory text — shows something that **does not actually work** as described. The test is correctly catching a real problem. **Fix the content first, in this repo, then update the test in docs-tests to match the corrected content** (on a same-named docs-tests branch, so the content PR tests both). Do not silently weaken or remove test assertions to hide content bugs.

Examples:
- A documented CEL expression (e.g. `json(response.body).model`) silently fails, so a response header the docs promise never appears → the visible `kubectl apply` block and example output are misleading readers. Flag this for a content fix. Don't just remove the assertion.
- An example YAML block has a wrong `apiVersion` or misindented field that causes the resource to behave differently than described → fix the visible YAML, then update the test.
- An example curl command shows a response that the product doesn't actually return → fix the example output.

#### How to tell the difference

Ask: **"If a customer follows the visible instructions exactly, will they get the documented result?"**
- **Yes** → Case 1. The test setup is wrong.
- **No** → Case 2. The content needs to be corrected. Raise the issue with the content owner if you can't determine the correct fix yourself.

When in doubt, flag the failure to the user rather than silently adjusting the test. A weakened assertion that hides a content bug is worse than a failing test.

#### Not a failure: needs update

If a tested block changed too much for its annotation to attach, the scenario is **skipped** with a warning, not run. The attach report and the PR's job summary list it. Re-attach the markup with `make annotate` and `make save`. The docs-tests README section "Telling what is broken" covers this case and the failure cases.

---

## Checklist (quick)

- [ ] All markup is in docs-tests (`make annotate` / `make save`), and **no** `paths=`, `{{< doc-test >}}`, or `test:` was added to any page in this repo.
- [ ] The **asset** file (`assets/agw-docs/...`) was annotated, **not** the content wrapper — even if multiple content files (e.g. `latest/` and `main/`) reuse the same asset.
- [ ] Multiple paths in `paths="..."` are **comma-separated**, not space-separated — `paths="a,b"` ✓, `paths="a b"` ✗ (spaces make the whole string a single path, silently excluding the block).
- [ ] No two selected blocks are **byte-identical** — the extractor keeps only the first and silently drops the rest, so a repeated `--validate-only` (or `start_gateway`, or warmup loop) across sections leaves later sections untested. Add a comment naming the section, then verify with `grep -c` on the source vs. the generated script. See "Repeated commands across sections" under step 3.
- [ ] A helper backend the test invents uses a port **no documented config uses** (avoid `8080`), its readiness check probes for a response only that backend produces, and cleanup is guarded with `|| true` so a failing `kill` in an `EXIT` trap does not fail the script under `set -e`.
- [ ] No helper **starts a background process inside `$( )`** — the PID is set in the subshell and lost, so the process is never killed and later configs run against the stale one; and its output gets captured into the returned value. Start with `start_gateway` in the parent shell, keep only pure-curl code inside the substitution. See "Never start a background process inside `$( )`" under step 4.
- [ ] If the guide has a long-running server, a **hidden** doc-test block starts it in the background (and optional trap/sleep); visible "start server" block has **no** path.
- [ ] Placeholders in shell blocks are quoted or use `${VAR:-default}` so the script has no syntax errors.
- [ ] The scenario in docs-tests `tests.yaml` lists the right prerequisites and `path`. For pages with no testable content (index pages, no code blocks), add the page under the manifest's `skip:` key instead — it counts toward coverage without generating test cases.
- [ ] The scenario uses `source:` (the asset file) so it covers every version, and `page:` only for a page with its own body.
- [ ] `needs:` prerequisites come from the guide's actual **Before you begin** links — don't guess; check the links.
- [ ] No `kubectl port-forward` in any visible block — replace with YAMLTest HTTP assertions using `${INGRESS_GW_ADDRESS}`.
- [ ] Host headers in YAMLTest `http.headers` use bare hostnames — no port suffix (e.g. `host: "example.com"`, not `host: "example.com:80"`). Including a port causes ECONNRESET, not an HTTP error.
- [ ] If the test creates an HTTPRoute with a hostname **not already in the prereq chain**, use the two-phase warmup fix: (1) add a curl warmup loop `{{< doc-test >}}` block before the YAMLTest block (`for i in $(seq 1 60); do curl -s --max-time 5 ... && break; sleep 2; done`) to cover Phase 1 (~120s of immediate resets), AND (2) add `retries: 1` to the **first** HTTP assertion in YAMLTest to absorb Phase 2 (4–26s hold then reset). Do **not** use `retries: 3` or higher without the warmup loop — it multiplies the total wait time.
- [ ] Cleanup blocks on multi-scenario pages (where the cleanup is shared across paths) use `--ignore-not-found` on `kubectl delete` commands. Single-scenario pages do not need it.
- [ ] YAMLTest `expect:` uses `bodyJsonPath` (not `jsonPath`) for response body assertions; all keys under `expect:` are at the same indentation level.
- [ ] YAML code blocks tagged with `paths=` have correct indentation — list items nested under a mapping key (e.g. `filters`, `matches`, `rules`) must be indented 2+ spaces past the key, not at the same level.
- [ ] Display-only YAML blocks (no shell wrapper) are **not** tagged with `paths=` — use a hidden `{{< doc-test >}}` block with `cat <<'EOF' > config.yaml` instead.
- [ ] For MCP endpoint tests, use a JSON-RPC `initialize` request (not a simple GET) — see the MCP endpoint testing section above.
- [ ] Examples that depend on external services (auth servers, rate limit services) that can't be stood up in the test are skipped — only self-contained examples are tested.
- [ ] `make test-generate` attached all of the markup, and the generated script order makes sense (server before curl/YAMLTest).
- [ ] If the test goes with a content PR, the docs-tests change is on a branch with the same name as the content PR's branch.
- [ ] Optional YAMLTest in a hidden block for HTTP or other assertions.
- [ ] When fixing a failing test, verified whether the bug is in the test or in the customer-facing content. If the content is wrong, fix the content first — don't silently weaken assertions.
- [ ] Produced a coverage summary (what is tested / what is not, with a reason for each gap) — both as a `{{< doc-test >}}` comment block in the test and in the reply to the user. See step 10.

---

## Standalone vs Kubernetes

| Aspect | Kubernetes | Standalone (binary) |
|--------|------------|---------------------|
| Runner | `make test-run`: creates a kind cluster, runs the script, deletes the cluster | `make test-generate`, then run the script manually or in CI with binary/Docker |
| Prereqs | Chain install → gateway → sample-app → feature | Often self-contained (install + config on same page) |
| Server process | Not needed in script (resources in cluster) | Must start binary in background in a hidden block |
| Env vars | Often `INGRESS_GW_ADDRESS` from gateway | Use `${VAR:-placeholder}` if test should pass when var is set |
| Directory | Feature pages in `main` or `latest`; prereqs typically in `latest` | Pages in `main` or `latest` |

---

## Reference

- Full framework: [scripts/TEST_FRAMEWORK.md](../../../scripts/TEST_FRAMEWORK.md)
- Scenarios: docs-tests `products/agentgateway/<kubernetes or standalone>/tests.yaml`
- Annotations: docs-tests `products/agentgateway/annotations/`, one file per page; `docs-tests/scripts/annotations.py` attaches them
- Extractor: `docs-tests/scripts/doc_test_extract.py` (block selection, reuse resolution, block order sort)
- Runner: `docs-tests/scripts/doc_test_run.py` (reads `tests.yaml` scenarios, generates scripts, optional kind run)
- How docs-tests works, including "Telling what is broken": the docs-tests README
