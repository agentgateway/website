## Verify LLM traces in Datadog

Both setups export LLM traces, so verify them the same way.

Open **AI Observability > Applications** and select `agentgateway`. The summary
shows LLM calls, token usage, duration, errors, and traces for the selected time
range.

{{< reuse-image src="img/datadog/agent-observability-overview.jpg" alt="Datadog Agent Observability overview for the agentgateway application, showing error rate, duration, token usage, LLM calls, and total traces." >}}

Open **AI Observability > Traces** and search for `ml_app:agentgateway`. Inspect
a span to verify its model, token counts, errors, timing, and parent-child trace
relationships. Allow several minutes for processing. A successful OTLP response
or a trace in APM alone does not prove ingestion into Agent Observability.

{{< reuse-image src="img/datadog/agent-observability-span.jpg" alt="Datadog Agent Observability span for agentgateway, showing the synthetic model and agentgateway cost and timing tags." >}}
