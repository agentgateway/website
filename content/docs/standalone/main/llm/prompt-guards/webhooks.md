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

## Customize the request path and headers

Use the `headers` field to set headers on the outgoing webhook request with [CEL expressions]({{< link-hextra path="/reference/cel/" >}}). Keys can be regular header names or the `:path`, `:method`, and `:authority` pseudo-headers; setting `:path` overrides the default `/request` or `/response` path. This is useful when your webhook service hosts other endpoints and can't dedicate its root path to the guardrail API, or when you want to forward context such as JWT claims to the webhook.

Expressions are evaluated against the original incoming request, so `request.*` and `jwt.*` refer to the client's request:

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
            ":path": '"/v3/guardrails/request"'
            x-user: jwt.sub
            x-tenant: request.headers["x-tenant"]
EOF
```

| Setting | Description |
| -- | -- |
| `headers` | A map of header names (or the `:path`, `:method`, `:authority` pseudo-headers) to CEL expressions, evaluated against the original client request. Setting `:path` replaces the default `/request` or `/response` path sent to the webhook target. |
