#!/bin/bash
# Build script that fetches test results and injects test status before Hugo build.
# Used by Vercel during deployment.

set -e

REPO="agentgateway/website"
ARTIFACT_NAME="doc-test-results"
RESULTS_DIR="out/tests/generated"
RESULTS_FILE="$RESULTS_DIR/test-results.yaml"

echo "=== Fetching latest doc test results ==="

# Create output directory
mkdir -p "$RESULTS_DIR"

# Check if we have a GitHub token for API access
if [ -n "$GITHUB_TOKEN" ]; then
    echo "Fetching artifact list from GitHub API..."
    
    # Get the latest successful workflow run
    RUN_INFO=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO/actions/workflows/doc-tests.yaml/runs?status=completed&per_page=5")
    
    # Find the most recent run that has artifacts
    RUN_ID=$(echo "$RUN_INFO" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for run in data.get('workflow_runs', []):
    if run.get('conclusion') in ['success', 'failure']:
        print(run['id'])
        break
" 2>/dev/null || echo "")
    
    if [ -n "$RUN_ID" ]; then
        echo "Found workflow run: $RUN_ID"
        
        # Get artifacts for this run
        ARTIFACTS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
            "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID/artifacts")
        
        ARTIFACT_URL=$(echo "$ARTIFACTS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for artifact in data.get('artifacts', []):
    if artifact.get('name') == '$ARTIFACT_NAME':
        print(artifact['archive_download_url'])
        break
" 2>/dev/null || echo "")
        
        if [ -n "$ARTIFACT_URL" ]; then
            echo "Downloading artifact..."
            curl -s -L -H "Authorization: token $GITHUB_TOKEN" \
                -o artifact.zip "$ARTIFACT_URL"
            
            if [ -f artifact.zip ]; then
                unzip -o -q artifact.zip -d "$RESULTS_DIR"
                rm artifact.zip
                echo "Artifact extracted to $RESULTS_DIR"
            fi
        else
            echo "Warning: No $ARTIFACT_NAME artifact found in run $RUN_ID"
        fi
    else
        echo "Warning: No completed workflow runs found"
    fi
else
    echo "Warning: GITHUB_TOKEN not set, skipping artifact download"
fi

# Inject test status if results file exists
if [ -f "$RESULTS_FILE" ]; then
    echo "=== Injecting test status into docs ==="
    python3 scripts/inject_test_status.py --repo-root .
else
    echo "Warning: $RESULTS_FILE not found, skipping test status injection"
fi

echo "=== Building Hugo site ==="
hugo --gc --minify
