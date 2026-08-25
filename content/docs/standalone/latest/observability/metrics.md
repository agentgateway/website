---
title: Metrics
weight: 10
description: View and monitor agentgateway metrics for traffic, LLM, MCP, and connection insights.
---

Agentgateway exposes a Prometheus-compatible metrics endpoint. Metrics are collected automatically for every request that passes through the gateway.

## View metrics

The metrics endpoint is available at port `15020` by default:

```sh
curl http://localhost:15020/metrics
```

Metrics are grouped under the `agentgateway_` prefix and follow the [OpenMetrics](https://openmetrics.io/) format.

## Available metrics

### HTTP traffic

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_requests_total` | Counter | Total HTTP requests. Labels: `backend`, `protocol`, `method`, `status`, `reason`, `bind`, `gateway`, `listener`, `route`, `route_rule`. |
| `agentgateway_request_duration_seconds` | Histogram | End-to-end request duration. Same labels as `requests_total`. |
| `agentgateway_request_processing_seconds` | Histogram | Duration from receiving the request to dispatching the outbound call. Labels: `backend`, `bind`, `gateway`, `listener`, `route`, `route_rule`. |
| `agentgateway_response_processing_seconds` | Histogram | Duration from receiving the upstream response to sending the HTTP response. Same labels as `request_processing_seconds`. |
| `agentgateway_response_bytes_total` | Counter | Total HTTP response bytes received from upstreams. Same labels as `requests_total`. |
| `agentgateway_retries_total` | Counter | Total request retries. Same labels as `requests_total`. |

### Generative AI / LLM

These metrics follow the [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/). They are only populated when an `ai` backend is in use. Labels include `gen_ai_operation_name`, `gen_ai_system`, `gen_ai_request_model`, `gen_ai_response_model`, `bind`, `gateway`, `listener`, `route`, `route_rule`.

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_gen_ai_client_token_usage` | Histogram | Number of tokens used per request. Additional label: `gen_ai_token_type` (`input` or `output`). |
| `agentgateway_gen_ai_client_cost_usd_total` | Counter | Cumulative USD cost of LLM requests. Requires a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}). |
| `agentgateway_gen_ai_server_request_duration` | Histogram | End-to-end LLM request duration. |
| `agentgateway_gen_ai_server_time_to_first_token` | Histogram | Time from request start to receiving the first streamed token. |
| `agentgateway_gen_ai_server_time_per_output_token` | Histogram | Average duration per output token (inverse of tokens per second). |
| `agentgateway_cost_catalog_lookups_total` | Counter | Model cost catalog lookups by resolution `status` (`Exact`, `Unpriced`, `Missing`, or `NoCatalog`). Labels: `bind`, `gateway`, `gen_ai_operation_name`, `gen_ai_request_model`, `gen_ai_response_model`, `gen_ai_system`, `listener`, `route`, `route_rule`, `status`. |

### MCP

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_mcp_requests_total` | Counter | Total MCP requests. Labels: `method`, `resource_type`, `server`, `resource`, `bind`, `gateway`, `listener`, `route`, `route_rule`. |

### Guardrails

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_guardrail_checks_total` | Counter | Total guardrail evaluations. Labels: `phase` (`request` or `response`), `action` (`allow`, `mask`, `reject`, or `fail_open`). |

### Connections and networking

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_downstream_connections_total` | Counter | Total inbound TCP connections established. Labels: `bind`, `gateway`, `listener`, `protocol`. |
| `agentgateway_downstream_received_bytes_total` | Counter | Total bytes received from downstream clients. Same labels. |
| `agentgateway_downstream_sent_bytes_total` | Counter | Total bytes sent to downstream clients. Same labels. |
| `agentgateway_upstream_connect_duration_seconds` | Histogram | Time to establish an upstream TCP connection. Label: `transport`. |
| `agentgateway_upstream_call_duration_seconds` | Histogram | Duration of all outbound calls, including policy callouts (ext_authz, ext_proc, guardrails, rate limits). Labels: `kind` (`Primary`, `Policy`, or `Mirror`), `subtype`. |
| `agentgateway_tls_handshake_duration_seconds` | Histogram | Time to complete an inbound TLS handshake. Labels: `bind`, `gateway`, `listener`, `protocol`. |

### Build info

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_build_info` | Info | Agentgateway build information. Label: `tag`. |

### XDS / Management

These metrics track communication with an XDS management server (Kubernetes mode). They are registered in all deployments but only increment when an XDS connection is active.

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_xds_connection_terminations_total` | Counter | Total completed connections to the XDS server (unstable). Label: `reason`. |
| `agentgateway_xds_message_total` | Counter | Total XDS messages received (unstable). Label: `url`. |
| `agentgateway_xds_message_bytes_total` | Counter | Total bytes received from the XDS server (unstable). Label: `url`. |

### Runtime

These metrics reflect the health of the agentgateway process itself and appear on every startup, regardless of traffic.

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_config_synchronized` | Gauge | Whether the last configuration load or reload succeeded. `1` = configuration is valid and in sync; `0` = the last reload failed and the previous configuration is still active. |
| `agentgateway_tokio_global_queue_depth` | Gauge | Number of tasks currently scheduled in the Tokio runtime's global queue. |
| `agentgateway_tokio_num_alive_tasks` | Gauge | Number of tasks currently alive in the Tokio runtime. |
| `agentgateway_tokio_num_workers` | Gauge | Number of worker threads used by the Tokio runtime. |

> [!NOTE]
> Metrics in the Generative AI, MCP, and Guardrails sections only appear in the output after the first request of that type. For example, `agentgateway_mcp_requests_total` is not present until MCP traffic is received. This is normal Prometheus behavior — counters and histograms are not pre-initialized.

## Prometheus configuration

To scrape agentgateway metrics with Prometheus, add a scrape job to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: agentgateway
    static_configs:
      - targets:
          - localhost:15020
    scrape_interval: 15s
```

The metrics port is `15020` when running agentgateway as a binary or Docker container. When running on Kubernetes, the pod is annotated with `prometheus.io/scrape: "true"` and `prometheus.io/port: "15020"` automatically.

## Add custom metric labels

You can enrich all metrics with custom labels computed from [CEL]({{< link-hextra path="/reference/cel/" >}}) expressions. Labels are added to every metric that carries the route identifier labels.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  metrics:
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
      - agentgateway_tls_handshake_duration_seconds
```

Metric names can be supplied with or without the `_total` and unit suffixes — agentgateway matches all variants.

## Learn more

{{< cards >}}
  {{< card path="/observability/grafana/" title="Grafana dashboard" subtitle="Visualize metrics with the pre-built Grafana dashboard" >}}
  {{< card path="/observability/traces/" title="Traces" subtitle="Distributed tracing with OpenTelemetry" >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="LLM-specific metrics, traces, and logs" >}}
{{< /cards >}}
