# Scripts for reference documentation generation

These files support the [reference-docs](../.github/workflows/reference-docs.yaml) workflow, which generates API reference, Helm, and metrics docs for the agentgateway on Kubernetes docs from the [kgateway-dev/kgateway](https://github.com/kgateway-dev/kgateway) repo and opens a PR on the website.

## Components

### `versions.json`

Single source of truth for doc versions. Each entry defines:

- **version** – Doc version (e.g. `2.2.x`, `2.3.x`).
- **linkVersion** – Site segment (`latest` or `main`).
- **url** – URL path for that version.
- **apiFile** – Generated API doc filename (e.g. `api-22x.md`).
- **kgatewayRef** – Branch or tag in kgateway to generate from (e.g. `v2.2.x`, `main`).
- **metricsSnippet** – Generated metrics snippet filename (e.g. `metrics-control-plane-22x.md`).

The workflow and `generate-ref-docs.py` read this file to decide which ref to use and where to write outputs. When you add a new doc version, add an entry here; no workflow YAML changes are required.

### `crd-ref-docs-config.yaml`

Configuration for [crd-ref-docs](https://github.com/elastic/crd-ref-docs). Used when generating Kubernetes API reference docs from kgateway’s `api/v1alpha1/agentgateway` types. The workflow passes this as `--config` to `go run github.com/elastic/crd-ref-docs@latest`.

### `generate-shared-types.py`

Python script that appends **shared types** documentation (e.g. CEL expression) to the generated API reference markdown. It parses Go source in kgateway’s shared and agentgateway packages, finds broken type links in the API doc, and appends markdown for those types so crd-ref-docs output is complete. The workflow runs it after writing the API doc:

- **Arguments:** `generate-shared-types.py <shared_dir> <doc_file> [source_dir...]`
- **shared_dir** – e.g. `kgateway/api/v1alpha1/shared`
- **doc_file** – e.g. `website/assets/agw-docs/pages/reference/api/api-22x.md`
- **source_dir** (optional) – e.g. `kgateway/api/v1alpha1/agentgateway`

If the doc file is missing, the script is skipped. If `shared_dir` does not exist, the script still runs and uses any provided source dirs.

### `generate-ref-docs.py`

Python script that generates **Helm** and **metrics** reference docs only (API docs are generated in the workflow). It expects:

- **DOC_VERSION** (required) – e.g. `2.2.x` or `2.3.x`; must exist in `versions.json`.
- **WEBSITE_DIR** (optional) – Path to the website repo root; default `"."`.
- **KGATEWAY_DIR** (optional) – Path to the checked-out kgateway repo; default `"kgateway"`.

It reads `scripts/versions.json` (relative to `WEBSITE_DIR`) and:

1. **Helm** – Runs helm-docs for the `agentgateway` and `agentgateway-crds` charts in kgateway and writes to `assets/agw-docs/pages/reference/helm/{version}/`.
2. **Metrics** – Runs kgateway’s findmetrics tool and writes to `assets/agw-docs/snippets/{metricsSnippet}` (e.g. `metrics-control-plane-22x.md`).

Requires Go (for helm-docs and findmetrics). No cloning; the workflow checks out kgateway before running the script.

## Relationship to the workflow

1. **Setup job** – Checks out the website, reads `scripts/versions.json`, resolves the kgateway ref for the chosen doc version, and verifies that branch exists.
2. **API docs step** – Checks out kgateway at that ref, runs crd-ref-docs with `scripts/crd-ref-docs-config.yaml`, and writes API markdown to `assets/agw-docs/pages/reference/api/{apiFile}`.
3. **Shared types step** – Runs `scripts/generate-shared-types.py` with kgateway’s shared and agentgateway API dirs and the API doc file, appending documentation for shared types (e.g. CEL) that crd-ref-docs does not emit.
4. **Helm and metrics step** – Runs `scripts/generate-ref-docs.py` with `DOC_VERSION`, `WEBSITE_DIR=website`, and `KGATEWAY_DIR=kgateway` so the script generates Helm and metrics into the website tree.
5. **Create PR** – Commits all changes under the website path and opens a PR.

To add a new doc version (e.g. 2.4.x), add an entry to `versions.json` with the appropriate `apiFile`, `kgatewayRef`, and `metricsSnippet`, then run the workflow with that version.
