---
title: LLM Observability
weight: 25
description: Monitor and analyze LLM usage with specialized observability platforms
---

Agent Gateway can send LLM telemetry to specialized observability platforms for prompt analytics, cost tracking, and performance monitoring.

{{< cards >}}
  {{< card link="langfuse" title="Langfuse" subtitle="Open-source LLM analytics" >}}
  {{< card link="langsmith" title="LangSmith" subtitle="LangChain's observability platform" >}}
  {{< card link="phoenix" title="Arize Phoenix" subtitle="LLM tracing and evaluation" >}}
  {{< card link="helicone" title="Helicone" subtitle="LLM monitoring and caching" >}}
{{< /cards >}}

## How it works

Agent Gateway exports LLM telemetry via OpenTelemetry, which can be forwarded to LLM-specific observability platforms. These platforms provide:

- **Prompt/response logging** - Full request and response capture
- **Token usage tracking** - Monitor costs across models and users
- **Latency analytics** - Track response times and identify bottlenecks
- **Evaluation** - Score and evaluate LLM outputs
- **Prompt management** - Version and manage prompts

## Configuration

Enable OpenTelemetry tracing with LLM-specific attributes:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: true

binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI:
              model: gpt-4o-mini
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
```

Agent Gateway automatically includes these LLM-specific trace attributes:

| Attribute | Description |
|-----------|-------------|
| `gen_ai.operation.name` | Operation type (chat, completion, embedding) |
| `gen_ai.request.model` | Requested model name |
| `gen_ai.response.model` | Actual model used |
| `gen_ai.usage.input_tokens` | Input token count |
| `gen_ai.usage.output_tokens` | Output token count |
| `gen_ai.provider.name` | LLM provider (openai, anthropic, etc.) |
