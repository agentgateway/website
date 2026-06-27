# Install the agentgateway nightly build, following the documented "Nightly build"
# steps (https://agentgateway.dev/docs/standalone/latest/quickstart/llm/). CI runs
# on Linux, so this downloads the release-binary-linux artifact from the latest
# successful nightly workflow run. Requires an authenticated `gh` with read access
# to the agentgateway/agentgateway repo's Actions artifacts.
RUN_ID=$(gh run list -R agentgateway/agentgateway --workflow nightly.yml --status success --limit 1 --json databaseId --jq '.[0].databaseId')
gh run download "$RUN_ID" -R agentgateway/agentgateway -n release-binary-linux
chmod +x agentgateway
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
mv agentgateway "$HOME/.local/bin/agentgateway"
