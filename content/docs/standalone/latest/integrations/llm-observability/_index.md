---
title: LLM observability
weight: 10
description: Send LLM telemetry for prompt logging, cost tracking, and audit trail.
test: skip
---

Agentgateway can send LLM telemetry to specialized observability platforms for prompt logging, cost tracking, audit trail, and performance monitoring.

## How it works

Agentgateway exports LLM telemetry via OpenTelemetry, which can be forwarded to LLM-specific observability platforms. These platforms provide the following.

- **Prompt/response logging** - Full request and response capture
- **Token usage tracking** - Monitor costs across models and users
- **Latency analytics** - Track response times and identify bottlenecks
- **Evaluation** - Score and evaluate LLM outputs
- **Prompt management** - Version and manage prompts

## Configuration

Enable OpenTelemetry tracing with LLM-specific attributes.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: true

gateways:
  default:
    port: 3000
routes:
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

Agentgateway automatically includes these LLM-specific trace attributes:

| Attribute | Description |
|-----------|-------------|
| `gen_ai.operation.name` | Operation type (chat, completion, embedding) |
| `gen_ai.request.model` | Requested model name |
| `gen_ai.response.model` | Actual model used |
| `gen_ai.usage.input_tokens` | Input token count, including the tokens read from or written to the prompt cache. See [Token usage fields]({{< link-hextra path="/llm/observability/#token-usage-fields" >}}). |
| `gen_ai.usage.output_tokens` | Output token count |
| `gen_ai.provider.name` | LLM provider (openai, anthropic, etc.) |

For a complete metrics, traces, and dashboard integration, see the
[Datadog observability guide]({{< link-hextra path="/observability/traces/configs/datadog/" >}}).
