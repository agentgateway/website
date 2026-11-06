---
title: Backend TLS
weight: 10
description: Configure TLS for secure connections to backend services.
---

Attaches to: {{< badge content="Backend" path="/documentation/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

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

> [!NOTE]
> To use TLS for a custom prompt guard webhook, set `target.policies.backendTLS` on the webhook target instead. For more information, see [Configure webhook backend policies]({{< link-hextra path="/documentation/llm/prompt-guards/webhooks/#configure-webhook-backend-policies" >}}).

## Invalid backend TLS settings {#invalid-backend-tls-settings}

If a backend TLS policy cannot be built, requests that use that backend fail with HTTP `503`. This fail-closed behavior applies in the following cases:

* The certificate files are invalid.
* The hostname or Subject Alternative Name (SAN) settings cannot be used.
* The crypto provider does not allow a configured key exchange group.

The proxy records a warning such as `invalid backend TLS policy, requests to the backend will fail: <error>`. The proxy does not connect to the backend in plaintext. An invalid update to a previously working backend TLS policy also fails closed.