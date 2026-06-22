# Product UI screenshots

This directory captures the screenshots of the **agentgateway product UI** (the admin UI
served on `:15000/ui/`) that the docs embed, using [Playwright](https://playwright.dev).
Every capture serves two purposes at once:

1. **Docs assets** — regenerate the `assets/img/*.png` files the guides display.
2. **Visual regression** — a nightly CI job re-captures and fails if the UI drifts from the
   committed images, so stale screenshots get caught.

This is separate from `scripts/TEST_FRAMEWORK.md` (which runs the *commands* in the docs
against a real cluster). This is the **frontend/visual** tier: it screenshots the running UI.

If you write or update a doc page that shows the product UI, this is how those images are
produced. The two most common tasks — [updating screenshots for a new agentgateway
version](#task-update-screenshots-for-a-new-agentgateway-version) and [adding a new guide
that has screenshots](#task-add-a-new-guide-that-has-screenshots) — are written up below.

---

## How it works

```
┌─ a launcher brings the UI up ─────────────────────────────┐
│  webServer runs the agentgateway docker image (the UI is  │
│  baked into the binary) + any backend a guide needs,      │
│  and waits until http://localhost:15100/ui/ is healthy    │
└───────────────────────────┬───────────────────────────────┘
                            ▼
┌─ Playwright captures (mode-agnostic) ─────────────────────┐
│  goto a UI route → interact → toHaveScreenshot('name.png')│
│  run once per theme: standalone-light and standalone-dark │
└───────────────────────────┬───────────────────────────────┘
                            ▼
┌─ the same PNGs become docs assets ────────────────────────┐
│  npm run sync-docs copies each baseline to its            │
│  assets/img/ destination, using docs-image-map.json       │
└────────────────────────────────────────────────────────────┘
```

- **One UI, many environments.** Playwright only needs `:15100/ui/` to be live. A
  `CAPTURE_MODE` env var selects which `scripts/serve-*.sh` launcher to run; each launcher
  starts whatever backend that guide needs (an MCP server, a mock LLM, etc.), runs the UI
  container, and tears everything down on exit. Specs that need no backend (the landing
  page, the CEL playground) run against the default empty-config image.
- **Light + dark.** Two Playwright projects (`standalone-light`, `standalone-dark`) run each
  spec twice. `fixtures/test.ts` seeds `localStorage['theme']` before load, so each project
  produces its own baseline.
- **Baseline = doc image.** `toHaveScreenshot('x.png')` writes a baseline under
  `__screenshots__/` and diffs against it. `npm run sync-docs` then copies the light and
  dark baselines to the `assets/img/` paths declared in `docs-image-map.json`.

## Prerequisites

- **Node 18+** (CI uses 20). The repo's default shell `node` may be older; use `nvm use 20`.
- **Docker** running. The default UI image is `cr.agentgateway.dev/agentgateway:v1.3.0`
  (arm64-native, so it runs fast on Apple Silicon and on CI without emulation).
- One-time setup:
  ```sh
  cd playwright
  npm install
  npx playwright install --with-deps chromium
  ```

> **Read this before committing images:** Playwright pixel baselines render slightly
> differently on macOS vs Linux, and **CI runs on Linux**. The committed baselines and doc
> images must be **Linux-rendered** to match CI. Generate the canonical set on Linux (see
> [Baselines and platforms](#baselines-and-platforms)); run captures on macOS for local
> preview only.

---

## Task: update screenshots for a new agentgateway version

When a new agentgateway release ships a changed UI and you need to refresh the docs images:

1. **Point the harness at the new release image.** Update the default in
   `playwright.config.ts` (`const IMAGE = ...`) and in each `scripts/serve-*.sh`
   (`IMAGE="${AGW_IMAGE:-...}"`), or set `AGW_IMAGE` for a one-off run:
   ```sh
   AGW_IMAGE=cr.agentgateway.dev/agentgateway:v1.5.0 npm run capture:all
   ```

2. **Preserve older versions' screenshots if the UI changed.** Docs are versioned
   (`main` = newest, `latest` = current release, plus frozen dirs like
   `content/docs/standalone/1.2.x/`), but `assets/img/` is **not** versioned — every version
   references images by filename. So before you overwrite the bare `assets/img/<x>.png`
   files, copy the outgoing ones into a dated bucket and repoint the older doc versions at
   it. The existing example is `assets/img/1.2-earlier/`, which holds the pre-1.3 (old UI)
   shots that the `1.2.x` guides use. If the UI is unchanged across releases, skip this —
   all new-UI versions share the same bare images. See
   [How images map to doc versions](#how-images-map-to-doc-versions).

3. **Regenerate the baselines and doc images** (on Linux — see
   [Baselines and platforms](#baselines-and-platforms)):
   ```sh
   npm run update:all     # re-capture every spec, refreshing __screenshots__ baselines
   npm run sync-docs      # copy the new baselines into assets/img/
   ```

4. **Review and commit.** Eyeball `git diff --stat assets/img` and open a few PNGs to
   confirm they show what the guide describes, then commit the changed `assets/img/*.png`
   **and** the `__screenshots__/` baselines together.

## Task: add a new guide that has screenshots

1. **Does the page need a backend?**
   - **No backend** (a static UI page like the CEL playground or the landing page): add your
     capture to an existing no-backend spec, or create a new `tests/<name>.spec.ts` and add
     it to the `test:standalone` script in `package.json`. These run against the default
     empty-config image.
   - **Needs a backend** (an MCP/LLM/OpenAPI playground that talks to a server): you'll add a
     fixture, a launcher, and a capture mode. See [Adding a backend
     mode](#adding-a-backend-mode) below.

2. **Write the spec** in `tests/<name>.spec.ts`. Navigate to the UI route, drive the page,
   and assert a screenshot. Reuse the helpers in `fixtures/test.ts`:
   - `dismissWelcome(page)` — clears the first-run "Welcome to Agentgateway" overlay.
   - `selectTool(page, 'echo')` — picks a tool in the MCP playground's dropdown.
   - `maskSession(page)` — masks the dynamic MCP session id so it doesn't break diffs.
   ```ts
   import { test, expect, dismissWelcome, maskSession } from '../fixtures/test';

   test('my new capture', async ({ page }) => {
     await page.goto('/ui/some/route');
     await page.waitForLoadState('networkidle');
     await dismissWelcome(page);
     // ...interact...
     await expect(page).toHaveScreenshot('my-image.png', { fullPage: true, ...maskSession(page) });
   });
   ```
   **Mask anything non-deterministic** (timestamps, latencies, generated IDs) with
   `toHaveScreenshot({ mask: [...] })`, or the image diffs on every run. See
   [Determinism](#determinism-and-gotchas).

3. **Map the image to its doc destination** in `docs-image-map.json`. Provide `light`, and
   `dark` if the guide shows a dark variant (most new-UI shots do):
   ```json
   "my-image.png": {
     "light": "assets/img/my-image.png",
     "dark": "assets/img/my-image-dark.png"
   }
   ```

4. **Reference the image in the guide.** New-UI screenshots use the theme-aware pair so
   light and dark each render in the matching site theme:
   ```md
   {{< reuse-image-light src="img/my-image.png" >}}
   {{< reuse-image-dark srcDark="img/my-image-dark.png" >}}
   ```
   If the guide is a **shared snippet** (under `assets/agw-docs/`) reused by multiple doc
   versions, wrap version-specific content in the version shortcode so old versions keep the
   old UI — see [How images map to doc versions](#how-images-map-to-doc-versions).

5. **Capture, sync, commit** (on Linux):
   ```sh
   npm run test:<mode> -- --update-snapshots   # or `npm run update` for no-backend specs
   npm run sync-docs
   ```
   Commit the guide change, the `docs-image-map.json` entry, the `__screenshots__/`
   baselines, and the `assets/img/` files.

### Adding a backend mode

For a guide whose UI talks to a server, add a self-contained capture mode:

1. **Fixture** `fixtures/<name>-config.yaml` — the gateway config. Because the UI image is
   distroless, **targets run as host-side HTTP servers** (you cannot `stdio`-exec a command
   inside the image). Point targets at `http://host.docker.internal:<port>` and keep
   `mcp.port`/`llm.port` at `3030` (the playground connects browser-side to that port, so it
   must be mapped identically). Mirror an existing fixture.
2. **Launcher** `scripts/serve-<name>-ui.sh` — start the backend(s) on the host, run the UI
   container with the fixture mounted, wait for `/ui/`, and clean up in a `trap`. Copy
   `scripts/serve-jwt-ui.sh` (simplest) or `serve-virtual-ui.sh` (two backends) as a
   template. For deterministic data, prefer a small mock (see `scripts/mock-*.mjs`) over a
   live third-party server.
3. **Register the mode** in two places:
   - `playwright.config.ts` → add `<name>: 'serve-<name>-ui.sh'` to the `SCRIPT_FOR` map.
   - `package.json` → add `"test:<name>": "CAPTURE_MODE=<name> playwright test tests/<name>.spec.ts --project=standalone-light --project=standalone-dark"`, and add it (with a `clean:ui` before it) to both `capture:all` and `update:all`.

---

## How images map to doc versions

Docs are versioned but images are not — `assets/img/` is a single flat tree that every
version references by filename. The version dropdown maps (see `hugo.yaml`):

| Doc tree | Version | UI |
|---|---|---|
| `content/docs/standalone/main/` | 1.4.x | new UI → bare `img/<x>.png` |
| `content/docs/standalone/latest/` | 1.3.x | new UI → bare `img/<x>.png` |
| `content/docs/standalone/1.2.x/` | 1.2.x and earlier | old UI → `img/1.2-earlier/<x>.png` |

So when the UI changes, the **older versions are pinned to a frozen image bucket**
(`assets/img/1.2-earlier/`) while the new-UI versions use the bare paths this harness
regenerates. Two ways a guide selects the right image:

- **Per-version files** (most guides, e.g. `mcp/connect/virtual.md`): each version dir has
  its own copy of the file. The `1.2.x` copy references `img/1.2-earlier/...` with the old
  prose; the `main`/`latest` copies reference the bare new images with the new-UI prose.
- **Shared snippets** (e.g. `assets/agw-docs/pages/observability/traces.md`, reused by all
  versions via `{{< reuse ... >}}`): one file serves every version, so version-specific
  parts are wrapped in the version shortcode:
  ```md
  {{< version exclude-if="1.2.x,1.1.x,1.0.x" >}}
  ...new-UI steps + bare img/ (reuse-image-light/dark)...
  {{< /version >}}
  {{< version include-if="1.2.x,1.1.x,1.0.x" >}}
  ...old-UI steps + img/1.2-earlier/ (plain reuse-image)...
  {{< /version >}}
  ```

When you regenerate images for a new UI, make sure any guide that older versions still need
points at a frozen bucket *before* you overwrite the bare files.

---

## Determinism and gotchas

Screenshots are pixel-compared, so captures must be byte-stable across runs:

- **Mask dynamic content.** The MCP session id, latency badges, and timestamps change every
  run — mask them (`maskSession(page)` covers the session id; pass others via
  `toHaveScreenshot({ mask: [...] })`).
- **Mock non-deterministic backends.** Live servers give varying output. The repo ships
  deterministic mocks used by the launchers:
  - `scripts/mock-openai.mjs` — fixed LLM reply (no API key, no cost).
  - `scripts/mock-mcp-time.mjs` — fixed "current time" (the real `mcp-server-time` is stdio,
    which the distroless image can't exec).
  - `scripts/mock-petstore.mjs` — serves the real Petstore OpenAPI spec + a fixed response
    (the `swaggerapi/petstore3` image is amd64-only and unusable under emulation on arm64).
    Set `PETSTORE_REAL=1` to use the real container instead (fine on native amd64, e.g. CI).
  `server-everything` (via `npx`) is deterministic enough to use directly.
- **First-run overlay.** A "Welcome to Agentgateway" overlay (`.startup-shell`) intercepts
  clicks when the gateway has no config — always `dismissWelcome(page)` after `goto`.
- **Pin viewport/scale.** Set in `playwright.config.ts` (1440×900, deviceScaleFactor 1).
  Don't change these casually; every baseline would shift.

## Baselines and platforms

Pixel rendering (font anti-aliasing especially) differs between macOS and Linux, and
**CI runs on Linux**, so:

- The **canonical baselines and doc images are Linux-rendered.** Generate them on Linux so
  the nightly drift check compares like-for-like. Options: run on a Linux host with Docker,
  or trigger the `playwright-screenshots` workflow.
- On **macOS**, `npm run update:all` works for local iteration and preview, but the PNGs it
  produces differ from CI's at the pixel level. Don't commit macOS-rendered images as the
  canonical set.
- Baselines live in `__screenshots__/<spec>.spec.ts-snapshots/<name>-<project>-<platform>.png`.
  The tolerance is `maxDiffPixelRatio: 0.01` (see `playwright.config.ts`).

## CI

`.github/workflows/playwright-screenshots.yml` runs on `ubuntu-latest`:

- **Nightly** (cron `0 6 * * *`) and on **manual dispatch**.
- Steps: `npm ci` → install Chromium → `npm run capture:all` → `npm run sync-docs` →
  `git diff --exit-code -- assets/img`. If the live UI no longer matches the committed
  images, the diff is non-empty and the job **fails**, flagging that the docs screenshots
  are stale. The Playwright HTML report is uploaded as an artifact for triage.

The job verifies; it does not commit. To refresh the committed images after an intended UI
change, regenerate them (Task above) and open a PR.

---

## Files

| File | Purpose |
|---|---|
| `playwright.config.ts` | `webServer` launcher selection (`CAPTURE_MODE` → `SCRIPT_FOR`), light/dark projects, viewport, diff tolerance |
| `docs-image-map.json` | Screenshot name → `{ light, dark? }` `assets/img/` destinations |
| `fixtures/test.ts` | Per-project theme seeding; `dismissWelcome` / `maskSession` / `selectTool` helpers |
| `fixtures/*-config.yaml` | Per-mode gateway configs (mcp, a2a, llm, virtual, openapi, jwt) + `standalone-config.yaml` (for `AGENTGATEWAY_BIN`) |
| `fixtures/petstore-openapi.json` | Bundled Swagger Petstore spec served by the openapi mock |
| `tests/smoke.spec.ts` `tests/landing.spec.ts` `tests/cel.spec.ts` | No-backend captures (run under `test:standalone`) |
| `tests/playground.spec.ts` | MCP playground (tools discovered + echo) |
| `tests/virtual.spec.ts` | Multiplex playground (prefixed tools + echo + time) |
| `tests/openapi.spec.ts` | OpenAPI → MCP (tool list + a `getInventory` call) |
| `tests/jwt.spec.ts` | Playground with a JWT in the Authorization header |
| `tests/a2a-traffic.spec.ts` | A2A config shown as a Traffic route/listener (no A2A playground in the new UI) |
| `tests/llm-playground.spec.ts` | LLM playground against the mock provider |
| `scripts/serve-*.sh` | Per-mode launchers: start backend(s) + UI container, clean up on exit |
| `scripts/mock-*.mjs` | Deterministic mock backends (openai, mcp-time, petstore) |
| `scripts/sync-docs-images.mjs` | Copies baselines → `assets/img/` via `docs-image-map.json` |
| `provisioners/kubernetes.ts` | Notes on the (not-yet-automated) Kubernetes capture path |
| `__screenshots__/` | Committed baselines (light + dark per spec) |

## npm scripts

| Script | Does |
|---|---|
| `test:standalone` | Capture/verify the no-backend specs (landing, cel, smoke) |
| `test:mcp` / `:a2a` / `:llm` / `:virtual` / `:openapi` / `:jwt` | Capture/verify one backend mode (brings up its backend + UI) |
| `capture:all` | Run every mode in sequence (what CI runs); `clean:ui` between modes |
| `update:all` | Same as `capture:all` but **regenerates** baselines (`--update-snapshots`) |
| `update` | Regenerate only the no-backend baselines (quick) |
| `sync-docs` | Copy baselines into `assets/img/` (`--dry-run` to preview) |
| `clean:ui` | Remove any leftover UI container publishing `:15100` |
| `report` | Open the last Playwright HTML report |

Append `-- --update-snapshots` to any `test:*` to refresh just that mode's baselines.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `AGW_IMAGE` | `cr.agentgateway.dev/agentgateway:v1.3.0` | UI docker image (bump for a new release) |
| `UI_HOST_PORT` | `15100` | Host port mapped to the container's `15000` |
| `UI_BASE_URL` | `http://localhost:15100` | Attach to an already-running UI instead of launching one (`reuseExistingServer`) |
| `AGENTGATEWAY_BIN` | — | Launch a local binary instead of the docker image |
| `CAPTURE_MODE` | `''` | Which `serve-*.sh` launcher to run (set by the `test:*` scripts) |
| `PETSTORE_REAL` | — | `1` runs the real Petstore container instead of the mock |

## Known limitations

- **Kubernetes landing (`observability/ui`) is not automated.** It needs a kind cluster +
  controller + a long-lived `kubectl port-forward` to the UI; `provisioners/kubernetes.ts`
  documents the intended path. Capture it manually for now by pointing `UI_BASE_URL` at a
  port-forwarded cluster UI.
- **`agentgateway-ui-playground.png`** (the initial playground view) is not regenerated; the
  rewritten guides open directly into the populated playground instead.
