---
title: Rewrites
weight: 13
description: Modify URL hostnames and paths of incoming requests dynamically.
test:
  rewrites:
  - file: content/docs/standalone/main/configuration/traffic-management/rewrites.md
    path: rewrites
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

{{< doc-test paths="rewrites" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

Modify URLs of incoming requests with {{< gloss "Rewrite" >}}rewrite{{< /gloss >}} policies.

For example, the following configuration modifies the request hostname to `example.com` and the request path to `/new-path`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: example.com
          path:
            full: /new-path
      backends:
      - host: example.com:443
```

{{< doc-test paths="rewrites" >}}
# WHAT THIS TEST VALIDATES:
#   * The urlRewrite example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the hostname/path are actually rewritten at runtime — requires a
#     backend the page omits to forward to and inspect.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: example.com
          path:
            full: /new-path
      backends:
      - host: example.com:443
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}