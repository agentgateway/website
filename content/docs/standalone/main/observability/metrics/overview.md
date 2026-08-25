---
title: Overview
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


## Scrape metrics with Prometheus

To scrape agentgateway metrics with Prometheus, add a scrape job to your `prometheus.yml`. The following example scrapes all metrics from the localhost port `15020`.

```yaml
scrape_configs:
  - job_name: agentgateway
    static_configs:
      - targets:
          - localhost:15020
    scrape_interval: 15s
```

> [!NOTE]
A Prometheus scrap cnfig is required when you use agentgateway as a binary or a Docker container. If you installed agentgateway on Kubernetes, the pod is automatically annotated with the `prometheus.io/scrape: "true"` and `prometheus.io/port: "15020"` annotations so that Prometheus can scape metrics without any additional configuration. 

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