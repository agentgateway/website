#----------------------------------------------------------------------------------
# Repo setup
#----------------------------------------------------------------------------------

.PHONY: init-git-hooks
init-git-hooks:  ## Use the tracked version of Git hooks from this repo
	git config core.hooksPath .githooks

#----------------------------------------------------------------------------------
# Doc tests
#----------------------------------------------------------------------------------

.PHONY: test-generate
test-generate:  ## Generate doc test scripts (no cluster)
	python3 scripts/doc_test_run.py --generate-only

.PHONY: test-run
test-run:  ## Run all doc tests
	python3 scripts/doc_test_run.py

.PHONY: test-artifacts-fetch
test-artifacts-fetch:  ## Fetch doc test artifacts
	bash scripts/doc_test_fetch_artifacts.sh

.PHONY: test-status
test-status:  ## Inject test status into markdown files
	python3 scripts/doc_test_inject_status.py


#----------------------------------------------------------------------------------
# Hugo
#----------------------------------------------------------------------------------

.PHONY: build
build:  ## Build the Hugo site
	hugo --gc --minify

.PHONY: serve
serve:  ## Start Hugo development server
	hugo147 server --buildDrafts --buildFuture

.PHONY: serve-prod
serve-prod:  ## Start Hugo server with production settings
	hugo147 server --gc --minify

.PHONY: clean
clean:  ## Clean Hugo build artifacts
	rm -rf public resources


#----------------------------------------------------------------------------------
# Combinations
#----------------------------------------------------------------------------------

.PHONY: fetch-test-artifacts-build
fetch-test-artifacts-build: test-artifacts-fetch test-status build  ## Fetch test artifacts, inject test status and build Hugo site

.PHONY: test-run-build
test-run-build: test-run test-status build  ## Run doc tests and build Hugo site


# Local builds

.PHONY: fetch-test-artifacts-serve
fetch-test-artifacts-serve: test-artifacts-fetch test-status serve  ## Fetch test artifacts, inject test status and serve Hugo site

.PHONY: test-run-serve
test-run-serve: test-run test-status serve  ## Run doc tests and serve Hugo site


#----------------------------------------------------------------------------------
# Help
#----------------------------------------------------------------------------------

.PHONY: help
help:  ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help