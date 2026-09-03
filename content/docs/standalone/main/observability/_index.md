---
title: Observability
weight: 67
icon: monitoring
description: Monitor agentgateway with metrics, distributed traces, and access logs.
prev: /docs/integrations
next: /docs/operations
test: skip
disableCards: true
---

Agentgateway exposes three observability signals out of the box: **metrics**, **distributed traces**, and **access logs**. You can use these signals individually or together with tools like Prometheus and Grafana to monitor traffic health, LLM performance, and MCP tool usage.

{{< cards >}}
  {{< card path="/observability/metrics/" title="Metrics" subtitle="Prometheus-compatible endpoint for request, LLM, MCP, and connection metrics" >}}
  {{< card path="/observability/traces/" title="Traces" subtitle="OTLP distributed tracing with OpenTelemetry semantic conventions for LLM and MCP traffic" >}}
  {{< card path="/observability/access-logs/" title="Access logs" subtitle="Per-request structured logs with CEL-based filtering, enrichment, and OTLP export" >}}
{{< /cards >}}

## Observability by traffic type

Different traffic types expose additional signal-specific fields.

- **LLM traffic**: token counts, model names, provider, cost, time to first token, and time per output token are available in all three signals. See [Observe LLM traffic]({{< link-hextra path="/llm/observability/" >}}).
- **MCP traffic**: session ID, method, server, and resource are available in traces and metrics. See [Observe MCP traffic]({{< link-hextra path="/mcp/mcp-observability/" >}}).

## External LLM observability platforms

For specialized LLM observability platforms with prompt logging, cost tracking, and evaluation capabilities, such as Langfuse, Langsmith, or Phoenix, see the [LLM Observability integrations]({{< link-hextra path="/integrations/llm-observability/" >}}).
