---
title: Mirroring
weight: 10
description: Send copies of requests to alternative backends for shadow testing.
test:
  mirroring:
  - file: content/docs/standalone/main/configuration/resiliency/mirroring.md
    path: mirroring
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}} {{< badge content="Backend" path="/configuration/backends/">}}

{{< doc-test paths="mirroring" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

Request {{< gloss "Mirroring" >}}mirroring{{< /gloss >}} allows sending a copy of each request to an alterative backend.
These request will not be retried if they fail.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        requestMirror:
          backend:
            host: localhost:8080
          # Mirror 50% of requests
          percentage: 0.5
      backends:
      - host: localhost:8000
```

{{< doc-test paths="mirroring" >}}
# WHAT THIS TEST VALIDATES:
#   * The requestMirror example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That requests are actually mirrored at runtime — requires live primary
#     and mirror backends the page omits to send to and inspect.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        requestMirror:
          backend:
            host: localhost:8080
          # Mirror 50% of requests
          percentage: 0.5
      backends:
      - host: localhost:8000
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}