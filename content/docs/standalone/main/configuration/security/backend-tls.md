---
title: Backend TLS
weight: 10
description: Configure TLS for secure connections to backend services.
test:
  backend-tls:
  - file: content/docs/standalone/main/configuration/security/backend-tls.md
    path: backend-tls
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/">}}

{{< doc-test paths="backend-tls" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

{{< doc-test paths="backend-tls" >}}
# Create self-signed certs referenced by the example
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj "/CN=localhost" 2>/dev/null
cp certs/cert.pem certs/root-cert.pem
{{< /doc-test >}}

By default, requests to backends use HTTP.
To use HTTPS, configure a backend {{< gloss "TLS (Transport Layer Security)" >}}TLS{{< /gloss >}} policy.

The following example shows a complete configuration that connects to a backend over HTTPS with a backend TLS policy.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8443
        policies:
          backendTLS:
            # A file containing the root certificate to verify.
            # If unset, the system trust bundle will be used.
            root: ./certs/root-cert.pem
            # For mutual TLS, the client certificate to use
            cert: ./certs/cert.pem
            # For mutual TLS, the client certificate key to use.
            key: ./certs/key.pem
            # If set, hostname verification is disabled
            # insecureHost: true
            # If set, all TLS verification is disabled
            # insecure: true
```

{{< doc-test paths="backend-tls" >}}
# WHAT THIS TEST VALIDATES:
#   * The backendTLS example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the TLS handshake to the backend succeeds at runtime — requires an
#     HTTPS backend on localhost:8443 the page omits.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8443
        policies:
          backendTLS:
            # A file containing the root certificate to verify.
            # If unset, the system trust bundle will be used.
            root: ./certs/root-cert.pem
            # For mutual TLS, the client certificate to use
            cert: ./certs/cert.pem
            # For mutual TLS, the client certificate key to use.
            key: ./certs/key.pem
            # If set, hostname verification is disabled
            # insecureHost: true
            # If set, all TLS verification is disabled
            # insecure: true
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}