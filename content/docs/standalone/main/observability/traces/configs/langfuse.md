---
title: Langfuse
weight: 30
description: Export agentgateway traces to Langfuse over OTLP/HTTP.
test: skip
aliases:
  - /docs/standalone/main/observability/traces/configs/saas/
---

[Langfuse](https://langfuse.com/) is a cloud-hosted LLM observability platform that accepts traces over OTLP/HTTP. Use `policies.requestHeaderModifier` to pass authentication credentials and `policies.backendTLS` to enable TLS. The same agentgateway configuration works regardless of whether you run the binary, Docker, or Helm.

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

For more information, see the [Langfuse OpenTelemetry documentation](https://langfuse.com/docs/observability/features/otel).
