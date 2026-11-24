---
title: Data plane metrics
weight: 20
description: View, customize, and reference data plane metrics emitted by the agentgateway proxy.
---

{{< reuse "agw-docs/pages/observability/metrics/dataplane-intro.md" >}}

## Data plane metrics reference

> [!NOTE]
> Counter and histogram metrics only appear after the first request of that type. For example, `agentgateway_mcp_requests_total` is not present until MCP traffic is received. This is normal Prometheus behavior. Counters and histograms are not pre-initialized.

The XDS metrics track communication with the agentgateway control plane. They are only present when agentgateway runs in Kubernetes mode.

The LLM metrics follow the [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/).

{{< reuse "agw-docs/snippets/metrics-data-plane-main.md" >}}

## Runtime and process metrics

The async runtime metrics appear on every startup, regardless of traffic.

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_tokio_num_workers` | Gauge | — | The number of worker threads the async runtime uses. |
| `agentgateway_tokio_num_alive_tasks` | Gauge | — | The number of tasks currently alive in the async runtime. |
| `agentgateway_tokio_global_queue_depth` | Gauge | — | The number of tasks currently scheduled in the async runtime's global queue. |

{{< reuse "agw-docs/pages/observability/metrics/dataplane-runtime.md" >}}

{{< reuse "agw-docs/pages/observability/metrics/dataplane-queries.md" >}}
