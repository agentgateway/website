{{< version include-if="main" >}}
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
{{< /version >}}
{{< version exclude-if="main" >}}
# Install the released agentgateway binary for this version to local bin without sudo.
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /version >}}
