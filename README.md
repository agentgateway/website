# agentgateway-dev/website Contribution Guide

## Getting Started

Required dependencies:

* `node.js` v18.18.2 or later
* `hugo` extended v0.160.1 or later

To run a local preview:

1. `gh repo clone agentgateway/website`

2. `cd website`

3. `npm install`

4. `hugo server`

5. [`http://localhost:1313`](http://localhost:1313)

## Framework tests

Rendered-HTML quality is checked by a shared Playwright harness that lives in
[solo-io/docs-theme-extras](https://github.com/solo-io/docs-theme-extras). The
harness asserts structural things (no shortcode delimiter leaks, no raw
markdown bleed, image alt text, tabs/mermaid/copy-md rendered correctly,
internal links resolve, etc.) against the built `public/` tree.

These are distinct from the doc tests (`make test-run`), which execute code
blocks against a cluster. Framework targets are prefixed `framework-test-*`.

### One-time setup

Clone `docs-theme-extras` as a sibling of this repo (or set
`FRAMEWORK_EXTRAS_DIR=/abs/path` on each make call), then install harness
deps and Playwright browser binaries:

```sh
cd ../
git clone https://github.com/solo-io/docs-theme-extras.git
cd <agentgateway/website_clone_directory>
make framework-test-install   # ~1-3 min, ~120-180 MB
```

### Day-to-day

```sh
make framework-test-static          # fastest, no browser launch
make framework-test-browser         # chromium only (tabs, mermaid, copy-md, ...)
make framework-test-cross-browser   # chromium + firefox + webkit
make framework-test                 # full suite
make framework-test-report          # re-open the last HTML report
```

Each target builds the site first with `hugo160 --gc --minify` (the local
build pin), then runs the harness via `DOCS_TEST_CONFIG=./.docs-test.toml`.
The HTML report auto-opens after the run; Ctrl+C dismisses the report
server. CI uses unpinned `hugo` via [`peaceiris/actions-hugo`](https://github.com/peaceiris/actions-hugo).

### CI

The same harness runs on PRs via
[`.github/workflows/framework-tests.yml`](.github/workflows/framework-tests.yml),
which pins to the SHA of `docs-theme-extras` recorded in `go.mod` so layouts
and tests stay in lockstep.

## Adopters

We’d love to highlight agentgateway adopters on our website! 🌟 If you're using agentgateway in a dev/test or production environment, feel free to add yourself to the [adopters file](data/adopters.yaml) by submitting a PR with your company name and logo. Thank you for your support! 💖

