---
title: LLM observability
weight: 10
description: Prompt logging, cost tracking, and audit trail via Langfuse, LangSmith, and more
test: skip
---

Agentgateway can send LLM telemetry to specialized observability platforms for prompt logging (request/response logging), cost tracking, audit trail, and performance monitoring.

{{< cards >}}
  {{< card link="langfuse" title="Langfuse" subtitle="Open-source LLM analytics" >}}
  {{< card link="langsmith" title="LangSmith" subtitle="LangChain's observability platform" >}}
{{< /cards >}}

## How it works

Agentgateway exports LLM telemetry via OpenTelemetry, which can be forwarded to LLM-specific observability platforms. These platforms provide the following.

- **Prompt/response logging** - Full request and response capture (also known as request logging, audit trail).
- **Token usage tracking** - Monitor costs across models and users (also known as cost tracking, spend monitoring).
- **Latency analytics** - Track response times and identify bottlenecks.
- **Evaluation** - Score and evaluate LLM outputs.
- **Prompt management** - Version and manage prompts.

## Configuration

Set up OpenTelemetry tracing to export LLM-specific telemetry. See the [OpenTelemetry stack setup guide]({{< link-hextra path="/observability/otel-stack/" >}}) for details.

Agentgateway automatically includes these LLM-specific trace attributes.

| Attribute | Description |
|-----------|-------------|
| `gen_ai.operation.name` | Operation type (chat, completion, embedding). |
| `gen_ai.request.model` | Requested model name. |
| `gen_ai.response.model` | Actual model used. |
| `gen_ai.usage.input_tokens` | Input token count. |
| `gen_ai.usage.output_tokens` | Output token count. |
| `gen_ai.provider.name` | LLM provider (openai, anthropic, etc.). |
