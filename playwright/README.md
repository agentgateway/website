# Product UI screenshot automation — proof of concept

> **Status: proof of concept.** This directory is a throwaway demonstration of how
> Playwright could capture screenshots of the **agentgateway product UI** (the admin
> UI served on `:15000`), for two purposes at once:
>
> 1. **Docs assets** — regenerate the `img/*.png` files embedded in the docs.
> 2. **Visual regression** — fail CI when the UI changes unexpectedly.
>
> It is **not** wired into CI and does **not** replace `scripts/TEST_FRAMEWORK.md`
> (which tests that the *commands in the docs* work against a real cluster). This is
> the missing **frontend/visual** tier: it screenshots the *running product UI*.

## The two layers

Playwright only ever needs `http://localhost:15000/ui/` to be live. **How** the UI got
there is a separate, mode-specific concern. That separation is what lets one set of
specs serve both standalone and Kubernetes modes:

```
┌─ env provisioner (mode-specific) ─────────────┐
│  standalone:  install binary → config.yaml →  │
│               run agentgateway (bg)           │
│  kubernetes:  kind → controller → app →       │
│               traffic resources → wait →      │
│               kubectl port-forward (bg)       │
└───────────────────────┬───────────────────────┘
                        │  guarantees :15000 is live + healthy
                        ▼
┌─ Playwright (mode-agnostic) ──────────────────┐
│  navigate /ui/ → interact → screenshot        │
└───────────────────────────────────────────────┘
```

Playwright **projects** model the two modes (`standalone`, `kubernetes`); each has its
own `globalSetup`/`globalTeardown` provisioner. Specs are tagged by the project(s) they
apply to. This POC implements the **standalone** provisioner fully and leaves the
Kubernetes provisioner as a documented stub (it reuses the cluster machinery already in
`scripts/TEST_FRAMEWORK.md`).

## One capture, both goals

`toHaveScreenshot()` writes a PNG on every run and diffs it against a committed baseline:

- **Regression** — the assertion fails when pixels drift from the baseline.
- **Docs assets** — a post-step (`scripts/sync-docs-images.mjs`) copies the captured
  PNGs to their `content/.../img/` destinations using a name → path map.

When the UI legitimately changes: `npm run update` refreshes the baselines, then the
sync step refreshes the doc images. One capture, both purposes.

## Quick start (standalone mode)

Prereqs: Node 18+, and the `agentgateway` binary on `PATH` (or set `AGENTGATEWAY_BIN`).

```sh
cd playwright
npm install
npx playwright install --with-deps chromium

# Run the standalone project (provisions the binary, screenshots, diffs)
npm run test:standalone

# Accept UI changes as the new baseline + refresh doc images
npm run update
npm run sync-docs
```

### Baseline stability — read before trusting diffs

Pixel diffing is extremely sensitive to font rendering, which differs across macOS and
Linux. **Generate and store baselines from inside the Playwright Docker image** so local
and CI rendering match byte-for-byte:

```sh
docker run --rm --network host -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.49.0-jammy \
  sh -c "npm ci && npm run update"
```

Dynamic UI content (timestamps, latency numbers, generated IDs) is masked per-spec via
`toHaveScreenshot({ mask: [...] })` — otherwise metrics screens diff on every run.

## Files

| File | Purpose |
|---|---|
| `playwright.config.ts` | Projects (`standalone`, `kubernetes`), screenshot/diff settings |
| `provisioners/standalone.ts` | Installs config, launches the binary, waits for `:15000` |
| `provisioners/kubernetes.ts` | **Stub** — documents the kind + port-forward reuse path |
| `fixtures/standalone-config.yaml` | Minimal MCP config the UI renders for the POC |
| `tests/playground.spec.ts` | Example: open UI, drive the MCP playground, screenshot |
| `scripts/sync-docs-images.mjs` | Copies captured PNGs → docs `img/` via a name→path map |
| `docs-image-map.json` | Screenshot name → doc image destination map |

## What this POC deliberately does NOT do

- It is not added to any GitHub Actions workflow.
- The Kubernetes provisioner is a stub, not a working cluster bring-up.
- The selectors in `tests/playground.spec.ts` are illustrative and will need to be
  matched to the real UI's DOM.
- `npm run sync-docs` is wired but the destination paths in `docs-image-map.json` should
  be confirmed against the actual docs before anyone commits regenerated images.
