---
name: doc-test-guides
description: Add executable doc tests to Agentgateway documentation guides using the doc test framework. Use when adding or planning tests for quickstart guides, standalone binary guides, or Kubernetes doc pages that should generate runnable scripts from code blocks.
---

# Doc test guides skill

Use this skill when adding tests to documentation guides in the `website` repo so that code blocks and hidden steps are assembled into runnable scripts. The canonical reference is [website/scripts/TEST_FRAMEWORK.md](website/scripts/TEST_FRAMEWORK.md). This skill summarizes the workflow and gotchas for **guides** (especially standalone/quickstart).

---

## When to use

- Adding a new test scenario to a guide for the agentgateway standalone or Kubernetes docs.
- Planning which files to change and how to tag paths for a doc test.
- Debugging generated scripts (order, env vars, background processes).

---

## Core concepts

1. **Test metadata** lives on the **content** page (e.g. `content/docs/standalone/main/quickstart/llm.md` or `content/docs/standalone/latest/quickstart/llm.md`) in YAML front matter under `test:`.
2. **Path tags and hidden blocks** live in the **content that gets inlined**. If the content page only has `{{< reuse "agw-docs/..." >}}`, the real body is in **assets** — add `paths="..."` and `{{< doc-test >}}` in the **asset** file, not the content wrapper.
3. **Extractor** resolves `{{< reuse "..." >}}` from `assets/`, so the script is built from the expanded content. Reference the **content file** in `test:` sources; the extractor will follow reuse.
4. **Block order**: Selected blocks are emitted in document order (by file and `start_line`). Hidden blocks (e.g. “start server in background”) must appear *before* any visible block that depends on them (e.g. curl). The extractor sorts selected blocks by `(file_path, start_line)` so hidden blocks are not deferred to the end.

---

## Workflow for adding a test to a guide

### 1. Identify content and asset files

- **Content file**: The doc page that will have `test:` in front matter (e.g. `content/docs/standalone/main/quickstart/llm.md` or `content/docs/standalone/latest/quickstart/llm.md`).
- **Asset file(s)**: Where the guide body lives. If the content page is only `{{< reuse "agw-docs/standalone/quickstart/llm.md" >}}`, the asset is `assets/agw-docs/standalone/quickstart/llm.md`. Add path tags and doc-test blocks in the asset.

> **Note**: The `main` directory contains docs for the development version, while `latest` contains the current stable release. Tests can be added to either or both, depending on which version the feature is available in.

### 2. Trace prerequisites

- Follow the guide’s **Before you begin** (or equivalent). For Kubernetes guides, chain back to install/setup (e.g. helm → gateway → sample-app → feature).
- For standalone guides there may be no doc prerequisites (e.g. “install the binary” is just a block on the same page).

### 3. Tag runnable blocks with paths

- Add `,paths="<name>"` to the **info string** of every fenced block that should run in the test (e.g. ` ```sh,paths="llm" `).
- Only `sh`/`bash`/`shell`/`yaml`/`yml` are extracted. Blocks without `paths=` are skipped when `skip_tabs_without_paths` is true.
- **Tabbed content**: Use different paths per tab (e.g. `paths="httpbin,httpbin-linux"` and `paths="httpbin-macos"`) so the scenario can pick one.

### 4. Long-running processes (standalone binary)

- The guide may show “run agentgateway” in the foreground. For the generated script, the process must run in the background so the script can continue (e.g. curl, YAMLTest).
- Add a **hidden** `{{< doc-test paths="<name>" >}}` block that runs the server in the background and cleans up, e.g.:
  - `agentgateway -f config.yaml &`
  - `AGW_PID=$!`
  - `trap 'kill $AGW_PID 2>/dev/null' EXIT`
  - `sleep 3`
- Do **not** add a path to the visible “run agentgateway” block so it is not included in the script; only the hidden block is.

### 5. Env vars and placeholders

- **Shell-safe placeholders**: Unquoted `<placeholder>` can be interpreted as redirection. Use quotes or a default, e.g. `export OPENAI_API_KEY='<your-api-key>'` or `export OPENAI_API_KEY="${OPENAI_API_KEY:-<your-api-key>}"`.
- **Optional real value**: Use `"${VAR:-placeholder}"` so the test can pass when the var is set (e.g. in CI or user’s shell) and still run with a placeholder when not set.

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
- For Kubernetes docs, prerequisite files often come from `latest` (e.g. `content/docs/kubernetes/latest/install/helm.md`) while the feature page may be in `main` or `latest`.

### 7. Optional: YAMLTest assertions

- For HTTP checks (e.g. “GET returns 200”), add a hidden `{{< doc-test paths="<name>" >}}` block with a YAMLTest snippet:
  - `YAMLTest -f - <<'EOF'` and a test entry with `http:` and `expect:` (e.g. `statusCode: 200`).
- Place it after the block that starts the server (so after the hidden “start in background” block in the doc).

### 8. Generate and verify

- From **website** directory: `python3 scripts/doc_test_run.py --repo-root . --generate-only`
- From repo root: `python3 website/scripts/doc_test_run.py --repo-root website --generate-only`
- Inspect `out/tests/generated/*.sh`: order of steps, no unresolved shortcodes, env vars and backgrounding correct.
- Run a script manually, e.g. `bash out/tests/generated/<script-name>.sh` (standalone tests do not use a kind cluster; use `--generate-only` and run the script in an env that has the binary/Docker/etc.).

---

## Checklist (quick)

- [ ] Path tags added in the **asset** file(s) for every runnable block needed in the scenario.
- [ ] If the guide has a long-running server, a **hidden** doc-test block starts it in the background (and optional trap/sleep); visible “start server” block has **no** path.
- [ ] Placeholders in shell blocks are quoted or use `${VAR:-default}` so the script has no syntax errors.
- [ ] `test:` front matter on the **content** page lists the right `file` and `path`; file path is the content path (extractor follows reuse).
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

- Full framework: [website/scripts/TEST_FRAMEWORK.md](website/scripts/TEST_FRAMEWORK.md)
- Extractor: `website/scripts/doc_test_extract.py` (block selection, reuse resolution, block order sort)
- Runner: `website/scripts/doc_test_run.py` (discovers `test:` pages, generates scripts, optional kind run)
