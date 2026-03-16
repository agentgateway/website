# Scripts for reference documentation generation

These files support the [reference-docs](../.github/workflows/reference-docs.yaml) workflow, which generates API reference, Helm, and metrics docs for the agentgateway on Kubernetes docs from the [agentgateway/agentgateway](https://github.com/agentgateway/agentgateway) repo and opens a PR on the website.

## Components

### `crd-ref-docs-config.yaml`

Configuration for [crd-ref-docs](https://github.com/elastic/crd-ref-docs). Used when generating Kubernetes API reference docs from agentgateway's `controller/api/v1alpha1/agentgateway` types. The workflow passes this as `--config` to `go run github.com/elastic/crd-ref-docs@latest`.

### `generate-shared-types.py`

Python script that appends **shared types** documentation (e.g. CEL expression) to the generated API reference markdown. It parses Go source in agentgateway's shared and agentgateway packages, finds broken type links in the API doc, and appends markdown for those types so crd-ref-docs output is complete. The workflow runs it after writing the API doc:

- **Arguments:** `generate-shared-types.py <shared_dir> <doc_file> [source_dir...]`
- **shared_dir** – e.g. `agentgateway/controller/api/v1alpha1/shared`
- **doc_file** – e.g. `website/assets/agw-docs/pages/reference/api/api-latest.md`
- **source_dir** (optional) – e.g. `agentgateway/controller/api/v1alpha1/agentgateway`

If the doc file is missing, the script is skipped. If `shared_dir` does not exist, the script still runs and uses any provided source dirs.

### `generate-ref-docs.py`

Python script that generates **Helm** and **metrics** reference docs only (API docs are generated in the workflow). It expects:

- **LINK_VERSION** (required) – `latest` or `main`; determines output file names and paths.
- **WEBSITE_DIR** (optional) – Path to the website repo root; default `"."`.
- **KGATEWAY_DIR** (optional) – Path to the agentgateway controller directory; default `"agentgateway/controller"`.

It generates:

1. **Helm** – Runs helm-docs for the `agentgateway` and `agentgateway-crds` charts and writes to `assets/agw-docs/pages/reference/helm/{link_version}/`.
2. **Metrics** – Runs agentgateway's findmetrics tool and writes to `assets/agw-docs/snippets/metrics-control-plane-{link_version}.md`.

Requires Go (for helm-docs and findmetrics). No cloning; the workflow checks out agentgateway before running the script.

## Relationship to the workflow

Version configuration is read directly from `hugo.yaml` (`params.sections.standalone.versions`). The workflow matches the requested `doc_version` (e.g. `1.0.x`) to a `linkVersion` (`latest` or `main`). For `latest`, the latest matching tag is resolved dynamically via the GitHub API (e.g. `1.0.x` → tag prefix `v1.0.` → resolves to `v1.0.0-rc.1`). For `main`, the main branch is used directly.

1. **Setup job** – Checks out the website, parses `hugo.yaml` for the requested version, resolves the agentgateway ref, and outputs `link_version` and `ref`.
2. **API docs step** – Checks out agentgateway at that ref, runs crd-ref-docs with `scripts/crd-ref-docs-config.yaml`, and writes API markdown to `assets/agw-docs/pages/reference/api/api-{link_version}.md`.
3. **Shared types step** – Runs `scripts/generate-shared-types.py` with agentgateway's shared and agentgateway API dirs and the API doc file, appending documentation for shared types (e.g. CEL) that crd-ref-docs does not emit.
4. **Helm and metrics step** – Runs `scripts/generate-ref-docs.py` with `LINK_VERSION`, `WEBSITE_DIR=website`, and `KGATEWAY_DIR=agentgateway/controller`.
5. **Create PR** – Commits all changes under the website path and opens a PR.

To add a new supported version, add an entry to `hugo.yaml` under `params.sections.standalone.versions` (and `kubernetes.versions`) with the appropriate `version` and `linkVersion`, then run the workflow with that version.
