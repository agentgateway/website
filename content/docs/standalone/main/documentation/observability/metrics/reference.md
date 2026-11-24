---
title: Metrics reference
weight: 50
description: Review the metrics that are available in agentgateway.
aliases:
  - ../../../reference/observability/metrics/
---

> [!NOTE]
> All counter and histogram metrics only appear in the output after the first request of that type. For example, `agentgateway_mcp_requests_total` is not present until MCP traffic is received. This is normal Prometheus behavior. Counters and histograms are not pre-initialized.

The XDS metrics track communication with an XDS management server. Agentgateway registers them only in Kubernetes mode against a control plane, so they do not appear on the metrics endpoint of a standalone process.

The LLM metrics follow the [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/). For the values of the `outcome` label on `agentgateway_mcp_requests_total`, see [MCP observability]({{< link-hextra path="/documentation/mcp/mcp-observability/#view-mcp-metrics" >}}).

{{< reuse "agw-docs/snippets/metrics-data-plane-main.md" >}}

## Runtime

These metrics reflect the async runtime of the agentgateway process. They appear on every startup, regardless of traffic.

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_tokio_num_workers` | Gauge | — | The number of worker threads that the async runtime uses. |
| `agentgateway_tokio_num_alive_tasks` | Gauge | — | The number of tasks that are currently alive in the async runtime. |
| `agentgateway_tokio_global_queue_depth` | Gauge | — | The number of tasks that are currently scheduled in the async runtime's global queue. |
