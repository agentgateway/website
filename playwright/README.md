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

In **standalone** mode, Playwright's `webServer` option launches (or reuses) the
agentgateway binary and waits for `:15000/ui/` to be healthy. One binary serves every
project — light vs. dark is a browser-side color scheme, not a separate instance — so the
`standalone-light` and `standalone-dark` projects share it. In **Kubernetes** mode you
bring the cluster up and start a `kubectl port-forward` to the UI yourself, then point
`UI_BASE_URL` at it; `reuseExistingServer` makes Playwright attach to it. The Kubernetes
path is documented in `provisioners/kubernetes.ts` (it reuses the cluster machinery in
`scripts/TEST_FRAMEWORK.md`) but not automated in this POC.

## One capture, both goals

`toHaveScreenshot()` writes a PNG on every run and diffs it against a committed baseline:

- **Regression** — the assertion fails when pixels drift from the baseline.
- **Docs assets** — a post-step (`scripts/sync-docs-images.mjs`) copies the captured
  PNGs to their `content/.../img/` destinations using a name → path map.

When the UI legitimately changes: `npm run update` refreshes the baselines, then the
sync step refreshes the doc images. One capture, both purposes.

## Building the UI binary (from PR #2232)

The product UI is embedded in the agentgateway binary at build time
(`include_dir!(".../ui/out")`). To screenshot the UI from a specific PR/branch, build
that binary. In a sibling `agentgateway/agentgateway` checkout:

```sh
# the UI build needs Node 18+ (PR #2232 is Vite + TanStack Router)
git fetch upstream pull/2232/head:pr-2232-ui && git checkout pr-2232-ui
( cd ui && npm ci && npm run build )       # -> ui/out
cargo build --features ui                  # -> target/debug/agentgateway (debug is fine)
```

The config auto-resolves this binary: `playwright.config.ts` defaults `AGENTGATEWAY_BIN`
to `../../agentgateway/agentgateway/target/debug/agentgateway` when present, else the one
on `PATH`, overridable via the `AGENTGATEWAY_BIN` env var.

## Quick start (standalone mode)

Prereqs: Node 18+ (use the binary built above, or any `agentgateway` on `PATH`).

```sh
cd playwright
npm install
npx playwright install --with-deps chromium

# Run on isolated ports so it never collides with an instance you already have running.
# UI_BASE_URL must match ADMIN_ADDR.
ADMIN_ADDR=localhost:15099 STATS_ADDR=localhost:15098 READINESS_ADDR=localhost:15097 \
  UI_BASE_URL=http://localhost:15099 npm run test:standalone

# Already have the UI running (e.g. `npm run dev` or a hand-started binary)? Just attach:
UI_BASE_URL=http://localhost:15000 npm run test:standalone   # reuseExistingServer

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
| `playwright.config.ts` | `webServer` launcher, light/dark projects, screenshot/diff settings |
| `provisioners/kubernetes.ts` | Notes only — the kind + port-forward reuse path |
| `fixtures/standalone-config.yaml` | Minimal MCP config the UI renders for the POC |
| `fixtures/test.ts` | Clears the persisted theme key so `colorScheme` controls light/dark |
| `tests/smoke.spec.ts` | Loads `/ui/` and screenshots it — proves the loop, no fragile selectors |
| `tests/playground.spec.ts` | Example interaction flow (selectors illustrative) |
| `scripts/probe-theme.mjs` | One-off diagnostic used to confirm the theme mechanism |
| `scripts/sync-docs-images.mjs` | Copies captured PNGs → docs `img/` via a name→path map |
| `docs-image-map.json` | Screenshot name → {light, dark} doc destinations |
| `__screenshots__/` | Committed baselines (incl. proven `ui-landing` light/dark captures) |

## Status: what works and what's left

**Proven working:** binary built from PR #2232 → `webServer` launch → browser → real
`/ui/` screenshot, in both light and dark. See `__screenshots__/smoke.spec.ts-snapshots/`.

**Left to do for full doc-image regeneration:**

- Not added to any GitHub Actions workflow.
- Kubernetes mode is documented (notes), not automated.
- `tests/playground.spec.ts` selectors are illustrative — match them to the real UI DOM.
  The PR's own `ui/tests` Playwright e2e specs are a ready source of real selectors.
- The fixture config + ports should give the UI real data to render (the smoke capture
  shows an empty/erroring home page because the throwaway config used a busy port).
- Confirm `docs-image-map.json` destinations (and which pages actually have dark variants)
  against the docs before committing regenerated images.
