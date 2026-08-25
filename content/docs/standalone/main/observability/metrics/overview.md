---
title: View and customize metrics
weight: 10
description: View and monitor agentgateway metrics for traffic, LLM, MCP, and connection insights.
---

Agentgateway exposes a Prometheus-compatible metrics endpoint on port 15020. Metrics are collected automatically for every request that passes through the gateway.

## View metrics

The metrics endpoint is available at port `15020` by default.

```sh
curl http://localhost:15020/metrics
```

Metrics are grouped under the `agentgateway_` prefix and follow the [OpenMetrics](https://openmetrics.io/) format. For an overview of available metrics, see the [metrics reference]({{< link path="/observability/metrics/reference/" >}}). 


For instructions on setting up Prometheus to scrape agentgateway metrics, see [Prometheus]({{< link-hextra path="/observability/metrics/prometheus/" >}}).

## Add custom metric labels

You can enrich all metrics with custom labels that are computed from [CEL]({{< link-hextra path="/reference/cel/" >}}) expressions. Labels are added to every metric that carries the route identifier labels.

The following example adds two labels to all metrics: 
- `env: '"production"'`: Adds a static label. The outer single quotes are YAML, the inner double quotes are the CEL string literal, so every metric gets `env="production"` appended.
- `user_id: 'request.headers["x-user-id"]'`: Adds a dynamic label. The CEL expression reads the `x-user-id` header from the incoming request, so `user_id` in the metric reflects whoever made the request.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  metrics:
    fields:
      add: 
        env: '"production"'
        user_id: 'request.headers["x-user-id"]'
```


## Remove metrics

To reduce cardinality or storage, you can exclude specific metrics by name:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  metrics:
    remove:
      - agentgateway_upstream_call_duration_seconds
```

Metric names can be supplied with or without the `_total` and `unit` suffixes. Agentgateway automatically matches all variants.