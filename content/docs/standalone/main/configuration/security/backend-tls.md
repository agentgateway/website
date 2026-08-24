---
title: Backend TLS
weight: 10
description: Configure TLS for secure connections to backend services.
test:
  backend-tls:
  - file: ${versionRoot}/configuration/security/backend-tls.md
    path: backend-tls
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="backend-tls" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="backend-tls" >}}
# Create self-signed certs referenced by the example
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj "/CN=localhost" 2>/dev/null
cp certs/cert.pem certs/root-cert.pem
{{< /doc-test >}}

By default, requests to backends use HTTP.
To use HTTPS, configure a backend {{< gloss "TLS (Transport Layer Security)" >}}TLS{{< /gloss >}} policy.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
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
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
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
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="backend-tls" >}}
# WHAT THIS TEST VALIDATES:
#   * The backendTLS example config is accepted by agentgateway in both the
#     routing-based (gateways) and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the TLS handshake to the backend succeeds at runtime — requires an
#     HTTPS backend on localhost:8443 the page omits.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
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

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
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
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

## Mutual TLS with a SPIFFE identity {#spiffe}

Instead of pointing `cert` and `key` at files on disk, the gateway can present an X.509-SVID that it reads from the [SPIFFE](https://spiffe.io/) Workload API. The gateway verifies the backend against the SPIFFE trust bundle, and rotates both the certificate and the bundle automatically.

Set the Workload API endpoint once, in the `config` section, and then set `backendTLS.spiffe` on each backend that originates mutual TLS.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  spiffe:
    endpoint: unix:///run/spire/agent.sock
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: upstream.example.com:8443
    policies:
      backendTLS:
        spiffe: {}
        # Accept only these upstream identities. Omit to accept any SVID
        # that chains to the trust bundle of your trust domain.
        subjectAltNames:
        - spiffe://example.org/ns/default/sa/upstream
```

Review the following table for the fields that apply to a SPIFFE backend.

| Field | Description |
| -- | -- |
| `config.spiffe.endpoint` | Address of the SPIFFE Workload API, such as `unix:///run/spire/agent.sock`. The gateway enables SPIFFE only when you set this field. |
| `backendTLS.spiffe` | An empty object that turns on SPIFFE for this backend. Mutually exclusive with `cert`, `key`, `root`, `insecure`, `insecureHost`, and `keyExchangeGroups`. |
| `backendTLS.subjectAltNames` | SPIFFE IDs that the gateway accepts in the certificate of the backend. Omit the field to accept any SVID that chains to the trust bundle. |

> [!NOTE]
> An SVID carries a `spiffe://` URI SAN and carries no DNS SAN, so a hostname check never applies to a SPIFFE backend. Pin an upstream identity with `subjectAltNames` rather than relying on the destination hostname.
>
> The gateway accepts only the SVIDs that chain to the trust bundle of its own trust domain. SPIFFE federation across trust domains is not supported.

> [!WARNING]
> A `backendTLS.spiffe` policy with no `config.spiffe.endpoint` passes validation, and then fails on each request with the message `backend TLS is configured for SPIFFE, but SPIFFE is not enabled`.

To serve a listener with the same identity, see [Listeners]({{< link-hextra path="/configuration/listeners/#spiffe" >}}).

{{< doc-test paths="backend-tls" >}}
# WHAT THIS TEST VALIDATES:
#   * The SPIFFE backendTLS example is accepted, including that `spiffe: {}` and
#     `subjectAltNames` coexist and that `config.spiffe.endpoint` is the enabling
#     field.
#   * That `spiffe` and `cert` are rejected together, which is the mistake a reader
#     converting an existing backendTLS block is most likely to make.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * A real SPIFFE handshake. That needs a running Workload API provider and an
#     SVID-serving upstream, which this page does not deploy. The Kubernetes SPIFFE
#     guide covers the runtime path end to end.
cat <<'EOF' > config-spiffe.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  spiffe:
    endpoint: unix:///run/spire/agent.sock
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: upstream.example.com:8443
    policies:
      backendTLS:
        spiffe: {}
        subjectAltNames:
        - spiffe://example.org/ns/default/sa/upstream
EOF
agentgateway -f config-spiffe.yaml --validate-only

# `spiffe` cannot be combined with file-based certificates.
cat <<'EOF' > config-spiffe-invalid.yaml
config:
  spiffe:
    endpoint: unix:///run/spire/agent.sock
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: upstream.example.com:8443
    policies:
      backendTLS:
        spiffe: {}
        cert: ./certs/cert.pem
        key: ./certs/key.pem
EOF
if agentgateway -f config-spiffe-invalid.yaml --validate-only 2>/dev/null; then
  echo "ERROR: spiffe + cert should have been rejected" >&2
  exit 1
fi
{{< /doc-test >}}
