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

## Populated captures (real data, one command each)

`smoke.spec.ts` works against the default empty gateway. The playground captures need a
backing server. `CAPTURE_MODE` tells `webServer` which `scripts/serve-*.sh` to launch (it
starts the backend + container and tears down on exit), so each is one command:

```sh
npm run test:mcp     # MCP playground   — server-everything + fixtures/mcp-playground-config.yaml
npm run test:a2a     # A2A traffic view — fixtures/a2a-config.yaml (static; no agent needed)
npm run test:llm     # LLM playground   — mock OpenAI provider + fixtures/llm-config.yaml
npm run test:virtual # multiplex (virtual MCP) — server-everything + mock-mcp-time (two targets)
npm run test:openapi # OpenAPI -> MCP    — Swagger Petstore container + openapi target
npm run test:jwt     # JWT / observability — server-everything; the spec fills the Bearer token

npm run capture:all  # run every mode above (+ test:standalone) in sequence — what CI runs
```

`npm run test:standalone` runs ONLY the no-backend captures (smoke / landing / cel) against
the empty-config image; the backend-dependent specs each run under their own `CAPTURE_MODE`.

Each `serve-*.sh` is also runnable standalone (then capture in another shell with
`UI_BASE_URL=http://localhost:15100 npm run test:<mode>`).

A shared constraint for the MCP and LLM playgrounds: the playground connects **browser-side**
to the listener at the SAME port it derives from config (`mcp.port` / `llm.port`), so that
port must be free on the host AND mapped identically (3030 here). The sl8 image is
distroless (no Node), so backends run on the host and the gateway reaches them via
`host.docker.internal`.

- **MCP** (`/ui/mcp/playground`; the docs' `/ui/playground/` is stale): **Apply CORS →
  Initialize → (echo auto-selected) → fill MESSAGE → Call tool**. The dynamic session id
  is masked.
- **LLM** (`/ui/llm/playground`): **Apply CORS → specify a concrete model (config model is
  `*`) → fill USER MESSAGE → Send**. Captured against a **mock OpenAI provider**
  (`scripts/mock-openai.mjs`) so the reply is fixed and no real key is needed; the reply
  streams token-by-token (assert on `body.innerText`), and the latency badge is masked.

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
| `playwright.config.ts` knobs | `CAPTURE_MODE` (mcp/a2a/llm/virtual/openapi/jwt) selects the `webServer` launcher |
| `fixtures/mcp-playground-config.yaml` | MCP playground config (port 3030 + host MCP target) |
| `fixtures/a2a-config.yaml` | A2A guide config for the Traffic route/listener capture |
| `fixtures/llm-config.yaml` | LLM config pointed at the mock OpenAI provider (hostOverride) |
| `fixtures/virtual-config.yaml` | Two MCP targets (time + everything) federated for the multiplex capture |
| `fixtures/openapi-config.yaml` | `openapi` target reading the Petstore schema file (mounted) |
| `fixtures/jwt-config.yaml` | MCP target + `metrics.tags` (`user: @sub`) for the JWT capture |
| `fixtures/standalone-config.yaml` | Minimal MCP config (used only with `AGENTGATEWAY_BIN`) |
| `fixtures/test.ts` | Seeds `localStorage['theme']` per project; `dismissWelcome`/`maskSession`/`selectTool` helpers |
| `tests/smoke.spec.ts` | Loads `/ui/`, dismisses welcome, screenshots — proves the loop |
| `tests/playground.spec.ts` | MCP playground capture (tools-discovered + echo response) |
| `tests/a2a-traffic.spec.ts` | A2A config as Traffic route + listener (no A2A playground exists) |
| `tests/llm-playground.spec.ts` | LLM playground capture against the mock provider |
| `tests/virtual.spec.ts` | Multiplex capture: multi-tools list, everything_echo, time_get_current_time |
| `tests/openapi.spec.ts` | OpenAPI capture: Petstore tools list + a successful getPetById call |
| `tests/jwt.spec.ts` | JWT capture: Authorization-header Bearer token + tools discovered |
| `scripts/serve-populated-ui.sh` | `CAPTURE_MODE=mcp` launcher: server-everything + the UI |
| `scripts/serve-a2a-ui.sh` | `CAPTURE_MODE=a2a` launcher: the UI with the A2A config |
| `scripts/serve-llm-ui.sh` | `CAPTURE_MODE=llm` launcher: mock-openai + the UI |
| `scripts/serve-virtual-ui.sh` | `CAPTURE_MODE=virtual` launcher: server-everything + mock-mcp-time + the UI |
| `scripts/serve-openapi-ui.sh` | `CAPTURE_MODE=openapi` launcher: Petstore container + the UI |
| `scripts/serve-jwt-ui.sh` | `CAPTURE_MODE=jwt` launcher: server-everything + the UI |
| `scripts/mock-openai.mjs` | Deterministic OpenAI-compatible mock (fixed reply, streaming + JSON) |
| `scripts/mock-mcp-time.mjs` | Deterministic MCP time server over streamable HTTP (get/convert time) |
| `scripts/probe-theme.mjs` | One-off diagnostic used to confirm the theme mechanism |
| `scripts/sync-docs-images.mjs` | Copies captured PNGs → docs `img/` via a name→path map |
| `docs-image-map.json` | Screenshot name → {light, dark?} doc destinations |
| `__screenshots__/` | Committed baselines (light+dark). Backend-mode baselines are generated in CI/Docker — see below |

## Status: what works and what's left

**Proven working (each is one command, self-contained, deterministic, light + dark):**
- `npm run test:standalone` → Gateway Overview screenshot.
- `npm run test:mcp` → MCP playground: initialize session, "N tools discovered", run
  `echo`, HTTP 200 → `ui-playground-tools/-tool-echo.png` (used in `mcp/connect/{http,stdio}.md`).
- `npm run test:a2a` → A2A config as Traffic route + listener → `ui-a2a-route/-listener.png`
  (the new UI has no A2A playground; see above).
- `npm run test:llm` → LLM playground against a mock provider → `ui-llm-playground.png`.
- `npm run sync-docs` copies the light baselines to their `assets/img/` destinations.

**Added for the backend-dependent guides (harness wired; baselines pending first capture):**
- `npm run test:virtual` → multiplex playground → `ui-playground-multi-tools.png`,
  `agentgateway-ui-tool-echo-hello.png`, `ui-tool-time-current.png`
  (used in `mcp/connect/virtual.md`; the echo image is shared with `observability/*`).
- `npm run test:openapi` → Petstore OpenAPI tools → `agentgateway-ui-tools-openapi.png`,
  `agentgateway-ui-tools-openapi-success.png` (used in `mcp/connect/openapi.md`).
- `npm run test:jwt` → playground with a JWT in the Authorization header →
  `agentgateway-ui-tools-jwt.png` (used in `reference/observability/metrics.md`).
- `capture:all` is wired into the nightly `playwright-screenshots` workflow.
- Matching guide prose for these (main + latest) is rewritten for the new-UI flow
  (Tool Playground → Apply CORS → Initialize → select tool → Call tool).

> **Baselines for the backend modes are NOT yet committed.** They must be generated inside
> the Playwright Linux container so they match CI byte-for-byte (see "Baseline stability"),
> and need Docker + the backends — generate them with
> `CAPTURE_MODE=<mode> npm run test:<mode> -- --update-snapshots` from inside the image, or
> let the nightly workflow produce them. On the first run, verify the inferred selectors
> (tool-argument labels, the OpenAPI `getPetById`/`petId` names, Petstore seed data) and the
> hand-rolled `mock-mcp-time` transport against the live UI; adjust if the gateway rejects it.

**Left to do for full doc-image regeneration:**

- `observability/ui` (Kubernetes landing, `agentgateway-ui-kube-landing.png`) — needs the
  Kubernetes provisioner (kind + controller + port-forward), still documented-only.
- `agent/a2a.md`'s playground section rewrite; confirm whether `llm/*` docs embed
  `ui-llm-playground.png`. The `ui-a2a-*` / `ui-llm-playground` destinations are provisional.
- `agentgateway-ui-playground.png` (the initial MCP playground view) is still the old-UI
  image — not regenerated in this batch; the rewritten guides drop the "open playground" shot.
- Confirm `docs-image-map.json` destinations against the docs before committing images.
