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
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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

If a `backendTLS` block is invalid, such as when the `root` file does not contain valid PEM, agentgateway rejects the configuration instead of sending requests to the backend without TLS. At startup, agentgateway exits with code `1` and an error such as `Error: base64 decode error: InvalidCharacter(33)`. When you edit the configuration file of a running agentgateway, agentgateway logs `Failed to reload config` with the error and keeps using the previous configuration.
