---
title: SaaS platform
weight: 30
description: Export agentgateway traces to a cloud-hosted SaaS observability platform such as Langfuse over HTTPS.
test: skip
---

SaaS observability backends, such as Langfuse, are cloud-hosted services that require no local infrastructure and expose a public OTLP endpoint over HTTPS. Use `policies.requestHeaderModifier` to pass authentication credentials and `policies.backendTLS` to enable TLS. The same agentgateway configuration works regardless of whether you run the binary, Docker, or Helm.

**Langfuse:**

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: us.cloud.langfuse.com:443
    protocol: http
    path: /api/public/otel
    randomSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          Authorization: "Basic <base64-encoded-public-key:secret-key>"
    attributes:
      gen_ai.operation.name: '"chat"'
      gen_ai.system: "llm.provider"
      gen_ai.request.model: "llm.requestModel"
      gen_ai.response.model: "llm.responseModel"
      gen_ai.usage.input_tokens: "llm.inputTokens"
      gen_ai.usage.output_tokens: "llm.outputTokens"
```

For more LLM observability platform integrations, see [LLM Observability integrations]({{< link-hextra path="/integrations/llm/observability/" >}}).