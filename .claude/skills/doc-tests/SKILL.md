---
name: doc-test-guides
description: Add executable doc tests to agentgateway documentation guides using the doc test framework. Use when the user asks to "add doc tests", "add tests to a guide", "add tests to a topic", mentions "YAMLTest", or is working on quickstart guides, standalone binary guides, or Kubernetes doc pages that should generate runnable scripts from code blocks.
version: 1.0.0
---

# Doc test guides skill

Use this skill when adding tests to documentation guides in the `agentgateway/website` repo so that code blocks and hidden steps are assembled into runnable scripts. The canonical reference is [scripts/TEST_FRAMEWORK.md](../../../scripts/TEST_FRAMEWORK.md). This skill summarizes the workflow and gotchas for **guides** (especially standalone/quickstart).

---

## When to use

- Adding a new test scenario to a guide for the agentgateway standalone or agentgateway on Kubernetes open source docs.
- Planning which files to change and how to tag paths for a doc test.
- Debugging generated scripts (order, env vars, background processes).

---

## Core concepts

1. **Test metadata** lives on the **content** page (e.g. `content/docs/standalone/main/quickstart/llm.md`) in YAML front matter under `test:`.
2. **Path tags and hidden blocks** live in the **content that gets inlined**. If the content page only has `{{< reuse "agw-docs/..." >}}`, the real body is in **assets** — add `paths="..."` and `{{< doc-test >}}` in the **asset** file, not the content wrapper.
   > **Critical**: Most Kubernetes topic pages (e.g. `content/docs/kubernetes/latest/resiliency/timeouts/request.md`) are thin wrappers that only contain `{{< reuse "agw-docs/pages/..." >}}`. **Always place doc-test blocks in the reuse file** (`assets/agw-docs/pages/...`), never in the content wrapper. This way both `latest` and `main` versions automatically inherit the tests — you only need to add them once.
3. **Extractor** resolves `{{< reuse "..." >}}` from `assets/`, so the script is built from the expanded content. Reference the **content file** in `test:` sources; the extractor will follow reuse.
4. **Block order**: Selected blocks are emitted in document order (by file and `start_line`). Hidden blocks (e.g. "start server in background") must appear *before* any visible block that depends on them (e.g. curl). The extractor sorts selected blocks by `(file_path, start_line)` so hidden blocks are not deferred to the end.

---

## Workflow for adding a test to a guide

### 1. Identify content and asset files

- **Content file**: The doc page that will have `test:` in front matter (e.g. `content/docs/standalone/main/quickstart/llm.md`).
- **Asset file(s)**: Where the guide body lives. If the content page is only `{{< reuse "agw-docs/standalone/quickstart/llm.md" >}}`, the asset is `assets/agw-docs/standalone/quickstart/llm.md`. Add path tags and doc-test blocks in the asset. **Never add `{{< doc-test >}}` blocks to the thin content wrapper** — they will only apply to that one version and won't be visible to the extractor that processes the reuse expansion.

> **Note**: The `main` directory contains docs for the development version, while `latest` contains the current stable release. Tests can be added to either or both, depending on which version the feature is available in.

### 2. Trace prerequisites

- Follow the guide's **Before you begin** (or equivalent). For Kubernetes guides, chain back to install/setup (e.g. helm → gateway → sample-app → feature).
- For standalone guides there may be no doc prerequisites (e.g. "install the binary" is just a block on the same page).

### 3. Tag runnable blocks with paths

- Add `{paths="<name>"}` to the **info string** of every fenced block that should run in the test (e.g. ` ```sh {paths="llm"} `).
- Only `sh`/`bash`/`shell`/`yaml`/`yml` are extracted. Blocks without `paths=` are skipped when `skip_tabs_without_paths` is true.
- **Tabbed content**: Use different paths per tab (e.g. `{paths="httpbin,httpbin-linux"}` and `{paths="httpbin-macos"}`) so the scenario can pick one.
- **Multiple paths must be comma-separated** — both in fenced block info strings (`{paths="a,b"}`) and in `{{< doc-test paths="a,b" >}}` shortcodes. The extractor splits on `,`, so space-separated values (e.g. `paths="a b"`) are treated as a single path name and will never match — causing the block to be silently excluded from the generated script. This is especially dangerous for shared setup blocks (e.g. "install binary") that need to run for multiple scenarios.
- **Display-only YAML blocks**: Some pages show YAML configs as plain display blocks (no `cat <<'EOF'` shell wrapper), unlike LLM guides that wrap configs in shell commands. You can't tag a display-only YAML block with `paths=` because it isn't a runnable shell command. Instead, add a **hidden** `{{< doc-test >}}` block that writes the config with `cat <<'EOF' > config.yaml`. See `content/docs/standalone/main/mcp/mcp-authz.md` for an example.
- **External service dependencies**: When a config example depends on an external service that can't be trivially stood up in the test (e.g. Keycloak on port 9000, a custom OIDC provider), skip that example and only test self-contained ones. It's better to test one example well than to skip the entire page.

### 4. Long-running processes (standalone binary)

- The guide may show "run agentgateway" in the foreground. For the generated script, the process must run in the background so the script can continue (e.g. curl, YAMLTest).
- Add a **hidden** `{{< doc-test paths="<name>" >}}` block that runs the server in the background and cleans up, e.g.:
  - `agentgateway -f config.yaml &`
  - `AGW_PID=$!`
  - `trap 'kill $AGW_PID 2>/dev/null' EXIT`
  - `sleep 3`
- Do **not** add a path to the visible "run agentgateway" block so it is not included in the script; only the hidden block is.

### 5. Env vars and placeholders

- **Shell-safe placeholders**: Unquoted `<placeholder>` can be interpreted as redirection. Use quotes or a default, e.g. `export OPENAI_API_KEY='<your-api-key>'` or `export OPENAI_API_KEY="${OPENAI_API_KEY:-<your-api-key>}"`.
- **Optional real value**: Use `"${VAR:-placeholder}"` so the test can pass when the var is set (e.g. in CI or user's shell) and still run with a placeholder when not set.

### 6. Add test front matter on the content page

```yaml
---
title: ...
test:
  <scenario-name>:
  - file: content/docs/standalone/main/quickstart/<page>.md
    path: <path-name>
---
```

**Pages with no testable content** (no code blocks, landing pages, concept pages, `_index.md` files without ordered steps, etc.) should be marked with `test: skip` instead of a scenario dict. This counts the page as covered in the test coverage report without generating any test cases:

```yaml
---
title: About
test: skip
---
```

Or for the latest (stable) version:

```yaml
---
title: ...
test:
  <scenario-name>:
  - file: content/docs/standalone/latest/quickstart/<page>.md
    path: <path-name>
---
```

- Use the **content** path for `file`. List sources in dependency order if chaining (install → … → feature).
- One scenario can list only the current page with one path if the guide is self-contained.
- For Kubernetes docs, prerequisite files often come from `latest` (e.g. `content/docs/kubernetes/latest/quickstart/install.md`) while the feature page may be in `main` or `latest`.

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

- For cleanup blocks tagged with a specific path, add `--ignore-not-found` to all `kubectl delete` commands. The tagged path may only create a subset of the resources the cleanup tries to delete (e.g., when a cleanup block covers resources from multiple scenarios but only one scenario runs in a given test).

### 8. Validate YAML code blocks

Before generating, review any `yaml`/`yml` fenced blocks tagged with `paths=` to catch indentation bugs that cause silent misconfigurations:

- **List items under a mapping key**: `- item:` followed by `- child:` at the same dash column means `child` is a sibling, not a child. Indent `- child:` 2 more spaces to nest it properly.
- **Common hotspot**: `rules[].filters` in HTTPRoute specs. A misindented `- type: RequestRedirect` becomes a second rule instead of a filter entry, resulting in a route with no filter and no backend — the gateway resets the connection (`ECONNRESET`) instead of returning the expected HTTP response.
- **Quick check**: For any `key:\n  - subkey:` pattern, verify the `-` of the list item is indented at least 2 spaces past the start of `key`.

### 9. Generate and verify

- From the repo root directory: `python3 scripts/doc_test_run.py --repo-root . --generate-only`
- From repo root: `python3 scripts/doc_test_run.py --generate-only`
- Inspect `out/tests/generated/*.sh`: order of steps, no unresolved shortcodes, env vars and backgrounding correct.
- Run a script manually, e.g. `bash out/tests/generated/<script-name>.sh` (standalone tests do not use a kind cluster; use `--generate-only` and run the script in an env that has the binary/Docker/etc.).

---

## Checklist (quick)

- [ ] Path tags and `{{< doc-test >}}` blocks added in the **asset** file(s) (`assets/agw-docs/...`), **not** in the content wrapper files — even if multiple content files (e.g. `latest/` and `main/`) reuse the same asset.
- [ ] Multiple paths in `paths="..."` are **comma-separated**, not space-separated — `paths="a,b"` ✓, `paths="a b"` ✗ (spaces make the whole string a single path, silently excluding the block).
- [ ] If the guide has a long-running server, a **hidden** doc-test block starts it in the background (and optional trap/sleep); visible "start server" block has **no** path.
- [ ] Placeholders in shell blocks are quoted or use `${VAR:-default}` so the script has no syntax errors.
- [ ] `test:` front matter on the **content** page lists the right `file` and `path`; file path is the content path (extractor follows reuse). For pages with no testable content (index pages, no code blocks), use `test: skip` instead — counts toward coverage without generating test cases.
- [ ] When copying a test chain between `main` and `latest`, **update every `file:` path** in front matter to match the target version directory.
- [ ] Prerequisite `file:` paths come from the guide's actual **Before you begin** links — don't guess; check the links to confirm exact paths.
- [ ] No `kubectl port-forward` in any visible block — replace with YAMLTest HTTP assertions using `${INGRESS_GW_ADDRESS}`.
- [ ] Host headers in YAMLTest `http.headers` use bare hostnames — no port suffix (e.g. `host: "example.com"`, not `host: "example.com:80"`). Including a port causes ECONNRESET, not an HTTP error.
- [ ] If the test creates an HTTPRoute with a hostname **not already in the prereq chain**, use the two-phase warmup fix: (1) add a curl warmup loop `{{< doc-test >}}` block before the YAMLTest block (`for i in $(seq 1 60); do curl -s --max-time 5 ... && break; sleep 2; done`) to cover Phase 1 (~120s of immediate resets), AND (2) add `retries: 1` to the **first** HTTP assertion in YAMLTest to absorb Phase 2 (4–26s hold then reset). Do **not** use `retries: 3` or higher without the warmup loop — it multiplies the total wait time.
- [ ] Cleanup blocks tagged with a path use `--ignore-not-found` on all `kubectl delete` commands.
- [ ] YAMLTest `expect:` uses `bodyJsonPath` (not `jsonPath`) for response body assertions; all keys under `expect:` are at the same indentation level.
- [ ] YAML code blocks tagged with `paths=` have correct indentation — list items nested under a mapping key (e.g. `filters`, `matches`, `rules`) must be indented 2+ spaces past the key, not at the same level.
- [ ] Display-only YAML blocks (no shell wrapper) are **not** tagged with `paths=` — use a hidden `{{< doc-test >}}` block with `cat <<'EOF' > config.yaml` instead.
- [ ] For MCP endpoint tests, use a JSON-RPC `initialize` request (not a simple GET) — see the MCP endpoint testing section above.
- [ ] Examples that depend on external services (auth servers, rate limit services) that can't be stood up in the test are skipped — only self-contained examples are tested.
- [ ] Generated script order makes sense (server before curl/YAMLTest); regenerate after extractor changes if needed.
- [ ] Optional YAMLTest in a hidden block for HTTP or other assertions.

---

## Standalone vs Kubernetes

| Aspect | Kubernetes | Standalone (binary) |
|--------|------------|---------------------|
| Runner | Creates kind cluster, runs script, deletes cluster | Use `--generate-only`; run script manually or in CI with binary/Docker |
| Prereqs | Chain install → gateway → sample-app → feature | Often self-contained (install + config on same page) |
| Server process | Not needed in script (resources in cluster) | Must start binary in background in a hidden block |
| Env vars | Often `INGRESS_GW_ADDRESS` from gateway | Use `${VAR:-placeholder}` if test should pass when var is set |
| Directory | Feature pages in `main` or `latest`; prereqs typically in `latest` | Pages in `main` or `latest` |

---

## Reference

- Full framework: [scripts/TEST_FRAMEWORK.md](../../../scripts/TEST_FRAMEWORK.md)
- Extractor: `scripts/doc_test_extract.py` (block selection, reuse resolution, block order sort)
- Runner: `scripts/doc_test_run.py` (discovers `test:` pages, generates scripts, optional kind run)
