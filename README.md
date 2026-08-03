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

Clone `docs-theme-extras` as a sibling of this repo:

```sh
cd ../
git clone https://github.com/solo-io/docs-theme-extras.git
cd <agentgateway/website_clone_directory>
make framework-test-install   # ~1-3 min, ~120-180 MB
```

### If your clone lives somewhere else

The Makefile defaults to `FRAMEWORK_EXTRAS_DIR=../docs-theme-extras`. Override
it when your clone is at a different path. Three ways, pick whichever fits
your workflow:

```sh
# 1. Per-command (no shell state):
make framework-test-static FRAMEWORK_EXTRAS_DIR=/abs/path/to/docs-theme-extras

# 2. Exported for the shell session (all subsequent `make` calls pick it up):
export FRAMEWORK_EXTRAS_DIR=/abs/path/to/docs-theme-extras
make framework-test-static

# 3. Persistent: add the export to your ~/.zshrc (or ~/.bashrc).
```

The same variable works for `framework-test-install` and every other
`framework-test-*` target.

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
server. CI pins to Hugo 0.160.1 via [`peaceiris/actions-hugo@v3`](https://github.com/peaceiris/actions-hugo).

### CI

The same harness runs on PRs via
[`.github/workflows/framework-tests.yml`](.github/workflows/framework-tests.yml),
which pins to the SHA of `docs-theme-extras` recorded in `go.mod` so layouts
and tests stay in lockstep.

## Contributing companies

We’d love to highlight the companies behind agentgateway! 🌟 Contributing organizations appear in the logo marquee on the [homepage](https://agentgateway.dev/). To add yours, open a PR using the [company logo template](https://github.com/agentgateway/website/compare?template=company-logo.md).

### The logo file

Add a single file to `static/logos/`. SVG preferred, or a transparent PNG at least 112px tall if you have no vector.

Logos render as a one-color silhouette: black in light mode, white in dark mode. You only need one file, and its colors are discarded, so:

* The background must be transparent. A background rectangle becomes a solid black or white box.
* The shape must be defined by transparency, not by light-colored fills — white knockout details turn black and disappear.
* No gradients or embedded raster images inside SVGs, and convert any text to outlines.
* Logos display at 56px tall, capped at 160px wide. Roughly 3:1 or squarer works best.
* Please submit a logo you’re authorized to use. 

The company name is shown as a text label beneath the logo, so the icon or symbol alone usually looks best.

### The markup

Add your entry to `layouts/partials/homepage-content.html` in **both** logo lists — the visible one and the `aria-hidden="true"` duplicate that makes the marquee loop seamlessly:

```html
<div class="hp-logo-item"><img src="/logos/yourcompany.svg" alt="Your Company" class="hp-logo-img"><span>Your Company</span></div>
```

Thank you for your support! 💖
