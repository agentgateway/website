#----------------------------------------------------------------------------------
# Agent Gateway OSS Website - Makefile
#----------------------------------------------------------------------------------
#
# Quick start:
#   make help              List all targets with short descriptions
#   make server             Run the site locally (drafts/future content included)
#   make build             Build the production site (public/)
#
# Common workflows:
#   make fetch-test-artifacts-server   Use latest CI test results and run the site
#   make test-run-server              Run doc tests locally, then run the site
#   make fetch-test-artifacts-build  Use latest CI test results and build for prod
#
# First-time setup:
#   make deps              Install Python deps (e.g. for doc test scripts)
#   make init-git-hooks    Use this repo's Git hooks (optional)



#----------------------------------------------------------------------------------
# Repo setup
#----------------------------------------------------------------------------------

# Use this repo's Git hooks (e.g. pre-commit) from .githooks
.PHONY: init-git-hooks
init-git-hooks:
	git config core.hooksPath .githooks

# Install Python dependencies (PyYAML) required for doc test scripts
.PHONY: deps
deps:
	pip3 install pyyaml


#----------------------------------------------------------------------------------
# Doc tests
#----------------------------------------------------------------------------------
# Doc tests run code blocks from markdown against a cluster. These targets support
# generating scripts, running tests, fetching CI results, and injecting pass/fail
# status into the markdown for the "Verified" badge.
#----------------------------------------------------------------------------------

# Generate doc test scripts from markdown (no cluster needed)
.PHONY: test-generate
test-generate: deps
	python3 scripts/doc_test_run.py --generate-only

# Run all doc tests (requires kubeconfig / cluster access)
.PHONY: test-run
test-run: deps
	python3 scripts/doc_test_run.py

# Download latest doc test results from GitHub Actions (main)
.PHONY: test-artifacts-fetch
test-artifacts-fetch:
	bash scripts/doc_test_fetch_artifacts.sh

# Write test pass/fail status into markdown front matter (for Verified badge)
.PHONY: test-status
test-status: deps
	python3 scripts/doc_test_inject_status.py


#----------------------------------------------------------------------------------
# Hugo
#----------------------------------------------------------------------------------

# Build the static site into public/ (production: GC, minify)
.PHONY: build
build:
	hugo --gc --minify

# Start local dev server (drafts and future-dated content shown)
.PHONY: server
server:
	hugo160 server --buildDrafts --buildFuture

# Start local server with production-like build (GC, minify, no drafts)
.PHONY: server-prod
servr-prod:
	hugo160 server --gc --minify

# Remove public/ and resources/ (Hugo output and cache)
.PHONY: clean
clean:
	rm -rf public resources


#----------------------------------------------------------------------------------
# Framework tests
#----------------------------------------------------------------------------------
# Playwright HTML harness from github.com/solo-io/docs-theme-extras. The harness
# does NOT build the site; these targets build first, then point Playwright at
# public/ via .docs-test.toml. Distinct from the doc tests above: those run
# code blocks against a cluster; these check rendered HTML quality.
#
# Targets are prefixed `framework-test-*` so they don't collide with the
# doc-test `test-*` namespace above.
#----------------------------------------------------------------------------------

# Path to a docs-theme-extras checkout that hosts the harness. CI sets this
# inside $GITHUB_WORKSPACE; locally it defaults to a sibling clone.
# Override with: make framework-test FRAMEWORK_EXTRAS_DIR=/abs/path
FRAMEWORK_EXTRAS_DIR ?= ../docs-theme-extras

# One-time install: npm packages and Playwright browser binaries (chromium,
# firefox, webkit) inside the docs-theme-extras checkout. ~120-180 MB of
# downloads, ~1-3 minutes.
.PHONY: framework-test-install
framework-test-install:
	@if [ ! -d "$(FRAMEWORK_EXTRAS_DIR)" ]; then \
		echo "docs-theme-extras checkout not found at $(FRAMEWORK_EXTRAS_DIR)." >&2; \
		echo "Clone it as a sibling, or set FRAMEWORK_EXTRAS_DIR=/path/to/docs-theme-extras." >&2; \
		exit 1; \
	fi
	cd $(FRAMEWORK_EXTRAS_DIR) && npm install
	cd $(FRAMEWORK_EXTRAS_DIR) && npx playwright install --with-deps chromium firefox webkit

# Build the site and run the full framework suite (static + browser +
# cross-browser). Always opens the HTML report after the run.
.PHONY: framework-test
framework-test:
	@$(MAKE) _framework_test_preflight
	hugo160 --gc --minify > .build.log 2>&1
	cd $(FRAMEWORK_EXTRAS_DIR) && \
		(DOCS_TEST_CONFIG=$(abspath ./.docs-test.toml) npx playwright test; \
		result=$$?; npx playwright show-report; exit $$result)

# Build the site and run only the static specs. Fastest iteration loop --
# no browser launch.
.PHONY: framework-test-static
framework-test-static:
	@$(MAKE) _framework_test_preflight
	hugo160 --gc --minify > .build.log 2>&1
	cd $(FRAMEWORK_EXTRAS_DIR) && \
		(DOCS_TEST_CONFIG=$(abspath ./.docs-test.toml) npx playwright test --project=static; \
		result=$$?; npx playwright show-report; exit $$result)

# Build the site and run chromium browser specs (tabs, mermaid, theme toggle,
# copy-md, console errors, viewport, contrast).
.PHONY: framework-test-browser
framework-test-browser:
	@$(MAKE) _framework_test_preflight
	hugo160 --gc --minify > .build.log 2>&1
	cd $(FRAMEWORK_EXTRAS_DIR) && \
		(DOCS_TEST_CONFIG=$(abspath ./.docs-test.toml) npx playwright test --project=browser; \
		result=$$?; npx playwright show-report; exit $$result)

# Build the site and run cross-browser desktop specs across chromium,
# firefox, and webkit.
.PHONY: framework-test-cross-browser
framework-test-cross-browser:
	@$(MAKE) _framework_test_preflight
	hugo160 --gc --minify > .build.log 2>&1
	cd $(FRAMEWORK_EXTRAS_DIR) && \
		(DOCS_TEST_CONFIG=$(abspath ./.docs-test.toml) npx playwright test \
			--project=cross-browser-chromium \
			--project=cross-browser-firefox \
			--project=cross-browser-webkit; \
		result=$$?; npx playwright show-report; exit $$result)

# Open the most recent Playwright HTML report. Handy when an earlier
# framework-test target was interrupted before reaching the report step.
.PHONY: framework-test-report
framework-test-report:
	@if [ ! -d "$(FRAMEWORK_EXTRAS_DIR)" ]; then \
		echo "docs-theme-extras checkout not found at $(FRAMEWORK_EXTRAS_DIR)." >&2; \
		exit 1; \
	fi
	cd $(FRAMEWORK_EXTRAS_DIR) && npx playwright show-report

# Shared preflight for the framework-test-* targets.
.PHONY: _framework_test_preflight
_framework_test_preflight:
	@if [ ! -d "$(FRAMEWORK_EXTRAS_DIR)" ]; then \
		echo "docs-theme-extras checkout not found at $(FRAMEWORK_EXTRAS_DIR)." >&2; \
		echo "Clone it as a sibling, or set FRAMEWORK_EXTRAS_DIR=/path/to/docs-theme-extras." >&2; \
		exit 1; \
	fi
	@if [ ! -d "$(FRAMEWORK_EXTRAS_DIR)/node_modules" ]; then \
		echo "Run 'make framework-test-install' first." >&2; exit 1; \
	fi


#----------------------------------------------------------------------------------
# Combined workflows
#----------------------------------------------------------------------------------
# One-step targets that chain: test data → inject status → build or server.
#----------------------------------------------------------------------------------

# Fetch CI test results, inject status, build site for production
.PHONY: fetch-test-artifacts-build
fetch-test-artifacts-build: test-artifacts-fetch test-status build

# Run doc tests, inject status, build site
.PHONY: test-run-build
test-run-build: test-run test-status build

# Fetch CI test results, inject status, server site locally
.PHONY: fetch-test-artifacts-server
fetch-test-artifacts-server: test-artifacts-fetch test-status server

# Run doc tests locally, inject status, server site locally
.PHONY: test-run-server
test-run-server: test-run test-status server


#----------------------------------------------------------------------------------
# Help
#----------------------------------------------------------------------------------

# Show all targets and their descriptions
.PHONY: help
help:
	@awk '/^# .*$$/ { desc=substr($$0,3); next } /^\.PHONY: / { gsub(/^\.PHONY: /,""); printf "\033[36m%-20s\033[0m %s\n", $$1, desc }' $(MAKEFILE_LIST) | sort -u

.DEFAULT_GOAL := help