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

In **standalone** mode, Playwright's `webServer` option launches (or reuses) the UI and
waits for `/ui/` to be healthy. By default it runs the prebuilt **docker image that ships
the new UI** (`howardjohn/agentgateway:sl8`, from PR #2232) on host port 15100; set
`AGENTGATEWAY_BIN` to launch a local binary instead. One instance serves every project —
light vs. dark is seeded per-project in `fixtures/test.ts` — so the `standalone-light` and
`standalone-dark` projects share it. In **Kubernetes** mode you
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

## Where the UI comes from

The product UI is embedded in the agentgateway binary at build time
(`include_dir!(".../ui/out")`), so each binary/image carries one UI version. This POC
captures the **new UI from PR #2232** via the prebuilt image `howardjohn/agentgateway:sl8`
— the default. (Building the binary locally from the PR branch also works, but it is easy
to embed a stale `ui/out`; the published image is the reliable source.)

To build a binary instead (in a sibling `agentgateway/agentgateway` checkout): check out
the branch, `cd ui && npm ci && npm run build` (Node 18+; PR #2232 is Vite + TanStack
Router), then `cargo build --features ui`, and run with `AGENTGATEWAY_BIN=<path>`.

## Quick start

Prereqs: Node 18+, Docker running (for the default image path).

```sh
cd playwright
npm install
npx playwright install --with-deps chromium

# Self-contained: webServer launches the sl8 image on host port 15100, captures, tears down.
npm run test:standalone

# Already have a UI running (your own `docker run`, `npm run dev`, or a k8s port-forward)?
# Attach to it (reuseExistingServer):
UI_BASE_URL=http://localhost:15100 npm run test:standalone

# Use a local binary build instead of the image:
AGENTGATEWAY_BIN=/path/to/agentgateway npm run test:standalone

# Accept UI changes as the new baseline + refresh doc images
npm run update
npm run sync-docs
```

The image's host port (default 15100) avoids colliding with a local agentgateway on
:15000. Override with `UI_HOST_PORT` / `AGW_IMAGE` / `UI_BASE_URL`.

## Populated MCP playground (real data, not the empty state)

`smoke.spec.ts` works against the default empty gateway. `playground.spec.ts` needs a
real MCP target so the playground can initialize a session, list tools, and run `echo`
(the flow in `mcp/connect/{http,stdio}.md`). Two things must be true:

1. An MCP test server runs on the host (`server-everything` on :3005).
2. The gateway's MCP listener is reachable from the browser at the SAME port the
   playground derives from `mcp.port` — so the port must be free on the host AND mapped
   identically (here 3030). The sl8 image is distroless (no Node), so the gateway can't
   spawn a stdio MCP server itself; hence the host server + `host.docker.internal`.

`scripts/serve-populated-ui.sh` sets all this up (config in `fixtures/mcp-playground-config.yaml`):

```sh
./scripts/serve-populated-ui.sh        # starts server-everything + the UI, prints the URL
# in another shell:
UI_BASE_URL=http://localhost:15100 npm run test:standalone
```

The playground flow in the new UI is **Apply CORS → Initialize → (echo auto-selected) →
fill MESSAGE → Call tool**, at route `/ui/mcp/playground` (the docs' `/ui/playground/` is
stale). The dynamic session id is masked in `toHaveScreenshot` so it never breaks baselines.

## A2A — no playground in the new UI

The new UI has **no A2A playground**. Its only playgrounds are `/llm/playground` and
`/mcp/playground`; the `a2a` route policy is not surfaced as its own type. So the old doc
images `ui-a2a-skills.png` / `ui-a2a-success.png` (from the previous UI) cannot be
regenerated — `agent/a2a.md`'s "Try out the playground" section needs rewriting around
what the new UI shows: the A2A config as a **Traffic route/listener**.

`a2a-traffic.spec.ts` captures that (static config views — no ADK agent needed):

```sh
./scripts/serve-a2a-ui.sh        # gateway with fixtures/a2a-config.yaml (localhost:9999)
# in another shell:
UI_BASE_URL=http://localhost:15100 npm run test:standalone -- a2a-traffic.spec.ts
```

Produces `ui-a2a-route.png` + `ui-a2a-listener.png` (light + dark). New image names with
provisional destinations in `docs-image-map.json` pending the guide rewrite.

### Theme (light/dark) — new UI specifics

The new UI (sl8) does **not** honor `prefers-color-scheme`. Theme is `<html data-theme>`
persisted in `localStorage['theme']`, toggled by `button[aria-label="Toggle theme"]`. So
`fixtures/test.ts` seeds `localStorage['theme']` to `light`/`dark` based on the project
name before load — that is what drives the two baseline sets. (Verified with
`scripts/probe-theme.mjs`.)

A first-run **"Welcome to Agentgateway" overlay** (`.startup-shell`) intercepts clicks
when the gateway has no config; call `dismissWelcome(page)` after load (clicks "Skip
setup"), or give the gateway a real config so it never appears.

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
| `fixtures/mcp-playground-config.yaml` | Gateway config for the populated playground (port 3030 + host MCP target) |
| `fixtures/a2a-config.yaml` | A2A guide config for the Traffic route/listener capture |
| `fixtures/standalone-config.yaml` | Minimal MCP config (used only with `AGENTGATEWAY_BIN`) |
| `fixtures/test.ts` | Seeds `localStorage['theme']` per project; `dismissWelcome()` helper |
| `tests/smoke.spec.ts` | Loads `/ui/`, dismisses welcome, screenshots — proves the loop |
| `tests/playground.spec.ts` | Real MCP playground capture (tools-discovered + echo response) |
| `tests/a2a-traffic.spec.ts` | A2A config as Traffic route + listener (no A2A playground exists) |
| `scripts/serve-populated-ui.sh` | Brings up server-everything + the UI for the playground capture |
| `scripts/serve-a2a-ui.sh` | Brings up the UI with the A2A config for the traffic capture |
| `scripts/probe-theme.mjs` | One-off diagnostic used to confirm the theme mechanism |
| `scripts/sync-docs-images.mjs` | Copies captured PNGs → docs `img/` via a name→path map |
| `docs-image-map.json` | Screenshot name → {light, dark?} doc destinations |
| `__screenshots__/` | Committed baselines (ui-landing, ui-playground-*, ui-a2a-*; light+dark) |

## Status: what works and what's left

**Proven working:**
- `npm run test:standalone` → sl8 image → Gateway Overview screenshot, light + dark.
- `playground.spec.ts` → real MCP playground: initialize session, "N tools discovered",
  run `echo`, HTTP 200 result — light + dark, → `ui-playground-tools/-tool-echo.png`
  (the images used in `mcp/connect/{http,stdio}.md`).
- `a2a-traffic.spec.ts` → A2A config as Traffic route + listener, light + dark →
  `ui-a2a-route/-listener.png` (the new UI has no A2A playground; see above).
- `npm run sync-docs` copies the light baselines to their `assets/img/` destinations.

**Left to do for full doc-image regeneration:**

- Not added to any GitHub Actions workflow.
- Kubernetes mode is documented (notes), not automated.
- `agent/a2a.md`'s playground section must be rewritten for the new UI (no A2A playground);
  the `ui-a2a-route/-listener` destinations in `docs-image-map.json` are provisional.
- Remaining doc images (OpenAPI, time-tool, `operations/ui` debug shots) need specs +
  backends. The LLM playground (`/llm/playground`) is another candidate (needs a provider key).
- Populated captures need the manual `serve-*.sh` setup; folding the MCP server + port
  mapping into `webServer` would make the playground capture one command.
- Confirm `docs-image-map.json` destinations against the docs before committing images.
