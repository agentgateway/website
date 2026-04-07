#----------------------------------------------------------------------------------
# Agent Gateway OSS Website - Makefile
#----------------------------------------------------------------------------------
#
# Quick start:
#   make help              List all targets with short descriptions
#   make serve             Run the site locally (drafts/future content included)
#   make build             Build the production site (public/)
#
# Common workflows:
#   make fetch-test-artifacts-serve   Use latest CI test results and run the site
#   make test-run-serve              Run doc tests locally, then run the site
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
.PHONY: serve
serve:
	hugo147 server --buildDrafts --buildFuture

# Start local server with production-like build (GC, minify, no drafts)
.PHONY: serve-prod
serve-prod:
	hugo147 server --gc --minify

# Remove public/ and resources/ (Hugo output and cache)
.PHONY: clean
clean:
	rm -rf public resources


#----------------------------------------------------------------------------------
# Combined workflows
#----------------------------------------------------------------------------------
# One-step targets that chain: test data → inject status → build or serve.
#----------------------------------------------------------------------------------

# Fetch CI test results, inject status, build site for production
.PHONY: fetch-test-artifacts-build
fetch-test-artifacts-build: test-artifacts-fetch test-status build

# Run doc tests, inject status, build site
.PHONY: test-run-build
test-run-build: test-run test-status build

# Fetch CI test results, inject status, serve site locally
.PHONY: fetch-test-artifacts-serve
fetch-test-artifacts-serve: test-artifacts-fetch test-status serve

# Run doc tests locally, inject status, serve site locally
.PHONY: test-run-serve
test-run-serve: test-run test-status serve


#----------------------------------------------------------------------------------
# Help
#----------------------------------------------------------------------------------

# Show all targets and their descriptions
.PHONY: help
help:
	@awk '/^# .*$$/ { desc=substr($$0,3); next } /^\.PHONY: / { gsub(/^\.PHONY: /,""); printf "\033[36m%-20s\033[0m %s\n", $$1, desc }' $(MAKEFILE_LIST) | sort -u

.DEFAULT_GOAL := help