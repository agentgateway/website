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

Configure a prompt guard to call your webhook service. You can use the [guardrail API](https://agentgateway.dev/docs/kubernetes/latest/llm/guardrails/) guide to create your own guardrail webhook in Kubernetes.  

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

## Configure a webhook timeout

Webhook calls use a 10-second timeout by default. The webhook target does not accept inline policies, so to change the timeout, define a named backend that sets `requestTimeout`, then reference that backend from the request and response guards.

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
      response:
      - webhook:
          target:
            backend: /content-safety-webhook
EOF
```

Backends are referenced as `<namespace>/<name>`. Backends defined in local configuration have no namespace, so the reference starts with `/`. The backend host must include a port.

The timeout applies separately to each webhook call, so request and response guards each receive their own timeout. A timeout is treated as a webhook failure. By default, `failureMode` is `failClosed`, which rejects the request, even when `action: audit` is set. Set `failureMode: failOpen` on the webhook to allow the request when the webhook times out or otherwise fails.

> [!NOTE]
> The backend host must be an address that agentgateway can reach, such as `localhost:8000` for a webhook running alongside the proxy.

## DeepKeep example

You can use [DeepKeep](https://www.deepkeep.ai/) as an external guardrail provider by running the [DeepKeep agentgateway webhook adapter](https://github.com/Deepkeepai/agentgateway-deepkeep-webhook). The adapter exposes the default Guardrail Webhook API paths that agentgateway calls and forwards checks to DeepKeep's pre-model and post-model moderation endpoints.

Run the adapter with the DeepKeep connection settings for your environment.

```sh
docker run --rm -p 8000:8000 \
  -e DEEPKEEP_BASE_URL=https://deepkeep.example \
  -e DEEPKEEP_API_KEY=dk_... \
  -e DEEPKEEP_MODEL=your-firewall-id \
  ghcr.io/deepkeepai/agentgateway-deepkeep-webhook:latest
```

Then configure agentgateway to send request and response guardrail checks to the adapter.

```yaml
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
            host: localhost:8000
      response:
      - webhook:
          target:
            host: localhost:8000
```

The adapter maps DeepKeep `block`, `redact`, `modify`, and `alert` actions to the Guardrail Webhook API actions that agentgateway understands.

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
