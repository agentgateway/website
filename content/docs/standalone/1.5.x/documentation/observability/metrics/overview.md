---
title: View and customize metrics
weight: 10
description: View and monitor agentgateway metrics for traffic, LLM, MCP, and connection insights.
test: skip
---

Agentgateway exposes a Prometheus-compatible metrics endpoint on port 15020. Metrics are collected automatically for every request that passes through the gateway.

## View metrics

The metrics endpoint is available at port `15020` by default.

```sh
curl http://localhost:15020/metrics
```

Metrics are grouped under the `agentgateway_` prefix and follow the [OpenMetrics](https://openmetrics.io/) format. For an overview of available metrics, see the [metrics reference]({{< link-hextra path="/documentation/observability/metrics/reference/" >}}). 


For instructions on setting up Prometheus to scrape agentgateway metrics, see [Prometheus]({{< link-hextra path="/documentation/observability/metrics/prometheus/" >}}).

## Metrics format {#metrics-format}

The proxy's `/metrics` endpoint returns metrics in one of two formats, based on the `Accept` header that the scraper sends. Scrapers use the `Content-Type` header of the response to decide how to parse the metrics, so the header must match the format.

### OpenMetrics text format {#openmetrics-text-format}

By default, the endpoint returns metrics in the [OpenMetrics](https://openmetrics.io/) text format. An OpenMetrics response ends with `# EOF`. In the response, counter samples end in `_total`, but the matching `# TYPE` line does not.

The proxy sets the `Content-Type` header to `application/openmetrics-text` only when the scraper requests OpenMetrics. The proxy sets the header to `text/plain` when the scraper sends one of the following:

* No `Accept` header.
* An `Accept` header with a wildcard, such as `*/*`.
* An `Accept` header that requests `text/plain`.
* An `Accept` header that requests only types that the proxy does not support.

Scrapers that rely on the `Content-Type` header then parse the response as classic Prometheus text and can drop metrics without an error. For example, the Datadog Agent without `use_latest_spec: true` drops every counter, while gauges and histograms still arrive. To avoid dropped metrics, use one of the following options:

* Configure your scraper to send the `Accept: application/openmetrics-text; version=1.0.0` header.
* In the Datadog `openmetrics` check for the proxy, set `use_latest_spec: true`.
* Upgrade to version 1.7 or later, which sets the `Content-Type` header to `application/openmetrics-text` by default.

Prometheus, the OpenTelemetry Collector Prometheus receiver, and Grafana Alloy request OpenMetrics by default and need no changes. Scrapers that cannot parse OpenMetrics, such as the Vector `prometheus_scrape` source, are not supported.

### Prometheus protobuf format {#prometheus-protobuf-format}

The endpoint returns metrics in the Prometheus protobuf format when the scraper requests protobuf, such as Prometheus with native histograms enabled. The proxy sets the `Content-Type` header to `application/vnd.google.protobuf`, so the scraper needs no extra configuration.

## Add custom metric labels

You can enrich all metrics with custom labels that are computed from [CEL]({{< link-hextra path="/reference/cel/" >}}) expressions. Labels are added to every metric that carries the route identifier labels.

The following example adds two labels to all metrics: 
- `env: '"production"'`: Adds a static label. The outer single quotes are YAML, the inner double quotes are the CEL string literal, so every metric gets `env="production"` appended.
- `user_id: 'request.headers["x-user-id"]'`: Adds a dynamic label. The CEL expression reads the `x-user-id` header from the incoming request, so `user_id` in the metric reflects whoever made the request.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
config:
  metrics:
    remove:
      - agentgateway_upstream_call_duration_seconds
```

Metric names can be supplied with or without the `_total` and `unit` suffixes. Agentgateway automatically matches all variants.