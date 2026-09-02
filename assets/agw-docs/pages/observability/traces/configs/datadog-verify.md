## Verify telemetry in Datadog

### Metrics and dashboard

Open **Metrics > Explorer**, filter by `env:datadog-dev`, and search for an
exact metric name such as:

- `agentgateway.requests.count`
- `agentgateway.gen_ai.token.usage.sum`
- `agentgateway.gen_ai.cost.usd.count`
- `agentgateway.controller.reconciliations.count` for the Kubernetes example

In **Dashboards**, import the example's
[`dashboard.json`](https://github.com/agentgateway/agentgateway/blob/main/examples/datadog/dashboard.json)
and set the `env` template variable to `datadog-dev`. Enable percentile
aggregations in Metrics Summary for the latency distributions before using the
p95 widgets. Controller, MCP, and guardrail widgets remain empty until their
corresponding components or traffic are present.

### LLM traces

Open **AI Observability > Applications** and select `agentgateway`. The summary
shows LLM calls, token usage, duration, errors, and traces for the selected time
range.

{{< reuse-image src="img/datadog/agent-observability-overview.jpg" alt="Datadog Agent Observability overview for the agentgateway application, showing error rate, duration, token usage, LLM calls, and total traces." >}}
{{< reuse-image-dark srcDark="img/datadog/agent-observability-overview.jpg" alt="Datadog Agent Observability overview for the agentgateway application, showing error rate, duration, token usage, LLM calls, and total traces." >}}

Open **AI Observability > Traces** and search for `ml_app:agentgateway`. Inspect
a span to verify its model, token counts, errors, timing, and parent-child trace
relationships. Allow several minutes for processing. A successful OTLP response
or a trace in APM alone does not prove ingestion into Agent Observability.

{{< reuse-image src="img/datadog/agent-observability-span.jpg" alt="Datadog Agent Observability span for agentgateway, showing the synthetic model and agentgateway cost and timing tags." >}}
{{< reuse-image-dark srcDark="img/datadog/agent-observability-span.jpg" alt="Datadog Agent Observability span for agentgateway, showing the synthetic model and agentgateway cost and timing tags." >}}

The complete example uses the synthetic `datadog-test` model. Because this
model is not in Datadog's pricing catalog, Datadog displays **Cost unavailable**.
This is expected. Agentgateway's fixture-based calculation remains available in
the span's `agw.ai.usage.cost.*` attributes and the
`agentgateway.gen_ai.cost.usd.count` metric. The example README explains how to
send a request to a real OpenAI model and compare Datadog's estimate with
agentgateway's calculation.

## Version compatibility

Agentgateway v1.5.0 records provider HTTP 429 and 500 responses in the span's
`http.status` attribute but leaves the OpenTelemetry span status unset. The
complete example's `collector.yaml` includes a compatibility processor that
marks these operations as errors. Remove `transform/gateway_errors` after
upgrading to an agentgateway release that contains
[PR #3261](https://github.com/agentgateway/agentgateway/pull/3261); the gateway
then classifies the response and records the numeric HTTP status as
`error.type`.
