# Install the agentgateway binary from the latest main (nightly) build.
# The nightly build publishes a container image tagged 'latest-dev'; extract the
# binary from that image. The GitHub release assets only exist for tagged
# releases, not for the in-development 'main' version.
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
docker rm -f agw-extract >/dev/null 2>&1 || true
docker create --name agw-extract cr.agentgateway.dev/agentgateway:latest-dev
docker cp agw-extract:/app/agentgateway "$HOME/.local/bin/agentgateway"
docker rm agw-extract
chmod +x "$HOME/.local/bin/agentgateway"
