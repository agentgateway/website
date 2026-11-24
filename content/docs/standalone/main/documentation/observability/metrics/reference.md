---
title: Metrics reference
weight: 50
description: Review the metrics that are available in agentgateway.
aliases:
  - ../../../reference/observability/metrics/
---

> [!NOTE]
> All counter and histogram metrics only appear in the output after the first request of that type. For example, `agentgateway_mcp_requests_total` is not present until MCP traffic is received. This is normal Prometheus behavior. Counters and histograms are not pre-initialized.

## Data plane metrics

The XDS metrics track communication with an XDS management server. Agentgateway registers them only in Kubernetes mode against a control plane, so they do not appear on the metrics endpoint of a standalone process.

The LLM metrics follow the [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/).

{{< reuse "agw-docs/snippets/metrics-data-plane-main.md" >}}

### MCP request outcomes

{{< reuse "agw-docs/pages/observability/metrics/dataplane-mcp-outcome.md" >}}

## Runtime and process metrics

{{< reuse "agw-docs/pages/observability/metrics/dataplane-runtime.md" >}}
