---
title: Redirects
weight: 11
description: Return direct redirect responses to send users to another location.
test:
  redirects:
  - file: content/docs/standalone/main/configuration/traffic-management/redirects.md
    path: redirects
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}} {{< badge content="Backend" path="/configuration/backends/">}}

{{< doc-test paths="redirects" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

Request {{< gloss "Redirect" >}}redirects{{< /gloss >}} allow returning a direct response redirecting users to another location.

For example, the following configuration will return a `307 Temporary Redirect` response with the header `location: https://example.com/new-path`:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        requestRedirect:
          scheme: https
          authority:
            full: example.com
          path:
            full: /new-path
          status: 307
```

{{< doc-test paths="redirects" >}}
# WHAT THIS TEST VALIDATES:
#   * The requestRedirect example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That a 307 redirect is actually returned at runtime — requires sending a
#     request and inspecting the response, which the page does not demonstrate.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        requestRedirect:
          scheme: https
          authority:
            full: example.com
          path:
            full: /new-path
          status: 307
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}