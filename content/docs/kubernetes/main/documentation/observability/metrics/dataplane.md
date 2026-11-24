---
title: Data plane metrics
weight: 20
description: View, customize, and reference data plane metrics emitted by the agentgateway proxy.
---

{{< reuse "agw-docs/pages/observability/metrics/dataplane-intro.md" >}}

## Data plane metrics reference

> [!NOTE]
> Counter and histogram metrics only appear after the first request of that type. For example, `agentgateway_mcp_requests_total` is not present until MCP traffic is received. This is normal Prometheus behavior. Counters and histograms are not pre-initialized.

The XDS metrics track communication between the agentgateway proxy and the control plane. These metrics do not appear when agentgateway runs in standalone mode.

The LLM metrics follow the [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/).

{{< reuse "agw-docs/snippets/metrics-data-plane-main.md" >}}

### MCP request outcomes

{{< reuse "agw-docs/pages/observability/metrics/dataplane-mcp-outcome.md" >}}

## Runtime and process metrics

{{< reuse "agw-docs/pages/observability/metrics/dataplane-runtime.md" >}}

{{< reuse "agw-docs/pages/observability/metrics/dataplane-queries.md" >}}
