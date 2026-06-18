# Playwright screenshots

This directory holds the screenshot pipeline for the agentgateway Admin UI.

It is separate from `scripts/doc_test_run.py`:

- doc tests prove the docs commands work against a real cluster
- Playwright captures UI screenshots that become committed doc assets

## Regenerate images

```sh
cd playwright
npm ci
npx playwright install --with-deps chromium
npm run update
npm run sync-docs
```

Or from the repo root:

```sh
make playwright-update-images
```

## Notes

- Theme is seeded per Playwright project so light and dark screenshots can share the
  same spec names.
- The generated PNGs are copied into `assets/img/` using `docs-image-map.json`.
- If the UI needs local setup instead of the default Docker image, set
  `AGENTGATEWAY_BIN=/path/to/agentgateway` before running Playwright.
