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

By default, agentgateway verifies the backend certificate against the host that it connects to. Set `hostname` when the certificate is issued for a different name. Agentgateway sends the configured name as Server Name Indication (SNI) and verifies the certificate against it.

## Mutual TLS and certificate rotation {#mtls-files}

To originate mutual TLS (mTLS) to a backend, set the `cert` and `key` fields of the `backendTLS` policy to the client certificate and private key files. Set `root` to the CA bundle that verifies the backend server certificate.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: backend.example.com:443
    policies:
      backendTLS:
        root: /etc/agentgateway/certs/ca.crt
        cert: /etc/agentgateway/certs/tls.crt
        key: /etc/agentgateway/certs/tls.key
```

Agentgateway reads these files at startup and watches them. When a file changes, agentgateway reloads the configuration and uses the new certificate for new connections to the backend. You do not need to restart agentgateway. This behavior is useful when another process, such as a certificate manager or a SPIFFE helper, renews the certificate on disk.

When agentgateway reloads, it logs the changed file.

```
info  state_manager  resource changed, reloading  resource="file:/etc/agentgateway/certs/tls.crt"
info  state_manager  loaded config from File("/etc/agentgateway/config.yaml")
```

If the new files are not valid, such as when the certificate is not PEM or does not match the key, agentgateway logs an error and keeps using the previous configuration.

```
error  state_manager  Failed to reload config: keys may not be consistent: KeyMismatch
```

If you replace the certificate and the key with two separate writes, agentgateway might log this error after the first write, because the new certificate does not match the old key. The reload succeeds after the second write.

> [!NOTE]
> The `config.fileAccess` setting does not apply to the files that your configuration file references, such as the `root`, `cert`, and `key` files. Agentgateway loads these files at startup and when they change.

## Invalid backend TLS settings {#invalid-backend-tls-settings}

If a `backendTLS` block is invalid, such as when the `root` file does not contain valid PEM, agentgateway rejects the configuration instead of sending requests to the backend without TLS. At startup, agentgateway exits with code `1` and an error such as `Error: base64 decode error: InvalidCharacter(33)`. When you edit the configuration file of a running agentgateway, agentgateway logs `Failed to reload config` with the error and keeps using the previous configuration.
