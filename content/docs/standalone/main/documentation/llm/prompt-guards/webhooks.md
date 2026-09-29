---
title: Custom webhooks
weight: 50
description: Integrate custom webhook servers to configure advanced content safety requirements.  
---

For advanced content safety requirements beyond regex and cloud provider services, you can integrate custom webhook servers. This allows you to use specialized ML models, proprietary detection logic, or integrate with existing security tools.

### Use cases for custom webhooks

- Named Entity Recognition (NER) for detecting person names, organizations, locations
- Industry-specific compliance rules (HIPAA, PCI-DSS, GDPR)
- Integration with existing DLP or security tools
- Custom ML models for domain-specific content detection
- Multi-step validation workflows
- Advanced contextual analysis

## Configuration

Configure a prompt guard to call your webhook service. You can use the [guardrail API](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/guardrails/) guide to create your own guardrail webhook in Kubernetes.  

> [!NOTE]
> To run this guard without blocking traffic, set `webhook.action: audit`. The guard records what it detects and forwards the content unchanged. For more information, see [Audit mode](../overview/#audit).

```yaml
cat <<EOF > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
    guardrails:
      request:
      - webhook:
          target:
            host: content-safety-webhook.example.com:8000
      response:
      - webhook:
          target:
            host: content-safety-webhook.example.com:8000
EOF
```

By default, agentgateway calls `POST /request` and `POST /response` on the webhook target.

## Configure webhook backend policies

Connect to a webhook target over TLS by authenticating or by tuning the connection with backend policies in the `target.policies` field. The following policies are supported: `backendTLS`, `backendAuth`, `backendTunnel`, `http` (such as `requestTimeout`), `tcp` (such as `connectTimeout`), `requestHeaderModifier`, and `transformations`. For every field, see the [configuration schema]({{< link-hextra path="/reference/configuration/schema/" >}}).

A `host` value that starts with `https://` enables backend TLS with the system trust bundle on port 443, unless the URL sets another port. Set `target.policies.backendTLS` when the webhook target needs a custom trust bundle, mutual TLS, a server name override, or relaxed certificate checks.

```yaml
cat <<EOF > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
    guardrails:
      request:
      - webhook:
          target:
            host: https://content-safety-webhook.example.com
            policies:
              backendTLS:
                root: ./certs/root-cert.pem
      response:
      - webhook:
          target:
            host: https://content-safety-webhook.example.com
            policies:
              backendTLS:
                root: ./certs/root-cert.pem
EOF
```

| Setting | Description |
| -- | -- |
| `target.host` | The webhook target as `host:port`, or as a URL with an `http://` or `https://` scheme and no path. |
| `target.policies` | Backend policies for the connection to the webhook target. |
| `target.policies.backendTLS` | TLS settings for the webhook connection. With an `https://` host, omit the field to use the system trust bundle. |

## Configure a webhook timeout

Webhook calls use a 10-second timeout by default. To change the timeout for an inline webhook target, set `target.policies.http.requestTimeout`.

```yaml
cat <<EOF > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
    guardrails:
      request:
      - webhook:
          target:
            host: content-safety-webhook.example.com:8000
            policies:
              http:
                requestTimeout: "35s"
          failureMode: failClosed
      response:
      - webhook:
          target:
            host: content-safety-webhook.example.com:8000
            policies:
              http:
                requestTimeout: "35s"
          failureMode: failClosed
EOF
```

To share one timeout across several guards, you can instead define a named backend that sets `requestTimeout`, then reference that backend from the request and response guards.

```yaml
cat <<EOF > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
backends:
- name: content-safety-webhook
  host: content-safety-webhook.example.com:8000
  policies:
    http:
      requestTimeout: "35s"
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
    guardrails:
      request:
      - webhook:
          target:
            backend: /content-safety-webhook
          failureMode: failClosed
      response:
      - webhook:
          target:
            backend: /content-safety-webhook
          failureMode: failClosed
EOF
```

Backends are referenced as `<namespace>/<name>`. Backends defined in local configuration have no namespace, so the reference starts with `/`.

The timeout applies separately to each webhook call, so request and response guards each receive their own timeout. A timeout is treated as a webhook failure. By default, `failureMode` is `failClosed`, which rejects the request, even when `action: audit` is set. Change `failureMode` to `failOpen` to allow the request when the webhook times out or otherwise fails.

> [!NOTE]
> A webhook `host` without an `http://` or `https://` scheme must include a port. With a scheme, the port defaults to 80 for `http://` and 443 for `https://`. The host must also be reachable from the proxy, such as `localhost:8000` for a webhook that runs alongside the proxy.

## DeepKeep

[DeepKeep](https://www.deepkeep.ai/) publishes a webhook adapter that connects agentgateway to its AI Firewall. For the setup steps, see [DeepKeep]({{< link-hextra path="/integrations/llm/guardrails/deepkeep/" >}}).

## Customize the request path and headers

Use the `headers` field to set headers on the outgoing webhook request from [CEL expressions]({{< link-hextra path="/reference/cel/" >}}). Set this field when your webhook service hosts other endpoints and cannot dedicate its root path to the guardrail API, or when you want to forward context such as JWT claims to the webhook.

Keys are either regular header names or the `:path`, `:method`, and `:authority` pseudo-headers. Setting `:path` overrides the default `/request` or `/response` path.

Expressions are evaluated against the original client request, not against the webhook request, so `request.*`, `jwt.*`, and `llmRequest.*` all refer to the request that the client sent to the gateway.

```yaml
cat <<EOF > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
    guardrails:
      request:
      - webhook:
          target:
            host: content-safety-webhook.example.com:8000
          headers:
            ":path": '"/api/guardrails/request"'
            x-user: jwt.sub
            x-tenant: request.headers["x-tenant"]
            x-model: llmRequest.model
EOF
```

| Setting | Description |
| -- | -- |
| `headers` | A map of header names, or the `:path`, `:method`, and `:authority` pseudo-headers, to CEL expressions. Each expression is evaluated against the original client request. |
| `:path` | Replaces the default `/request` or `/response` path that agentgateway sends to the webhook target. Your webhook service must serve the path that you set. The value is a CEL expression, so a literal path is a quoted string within single quotes, such as `'"/api/guardrails/request"'`. |

> [!NOTE]
> An expression that cannot be evaluated, such as `jwt.sub` on a request with no JWT, omits that header instead of failing the request. A `:path` expression that cannot be evaluated leaves the default `/request` or `/response` path in place. The `llmRequest.*` variables are available on request-phase webhooks only.
