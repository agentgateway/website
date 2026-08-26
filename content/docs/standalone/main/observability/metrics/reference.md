---
title: Metrics reference
weight: 20
description: Review the metrics that are available in agentgateway.
---

> [!NOTE]
> All counter and histogram metrics only appear in the output after the first request of that type. For example, `agentgateway_mcp_requests_total` is not present until MCP traffic is received. This is normal Prometheus behavior. Counters and histograms are not pre-initialized.

## XDS

These metrics track communication with an XDS management server (Kubernetes mode). They are registered in all deployments but only increment when an XDS connection is active.

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_xds_connection_terminations_total` | Counter | — | The total number of completed connections to xds server (unstable). |
| `agentgateway_xds_message_bytes_total` | Counter | bytes | Total number of bytes received (unstable). |
| `agentgateway_xds_message_total` | Counter | — | Total number of messages received (unstable). |

## HTTP

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_request_duration_seconds` | Histogram | seconds | Duration of HTTP requests (seconds). |
| `agentgateway_request_processing_seconds` | Histogram | seconds | Duration from receiving an HTTP request to sending the primary outbound call (seconds). |
| `agentgateway_requests_total` | Counter | — | The total number of HTTP requests sent. |
| `agentgateway_response_bytes_total` | Counter | bytes | Total HTTP response bytes received. |
| `agentgateway_response_processing_seconds` | Histogram | seconds | Duration from receiving the primary outbound response to sending the HTTP response (seconds). |
| `agentgateway_retries_total` | Counter | — | The total number of request retries. |

## TCP

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_downstream_connections_total` | Counter | — | The total number of downstream connections established. |
| `agentgateway_downstream_received_bytes_total` | Counter | bytes | Total TCP bytes received per connection labels. |
| `agentgateway_downstream_sent_bytes_total` | Counter | bytes | Total TCP bytes transmitted per connection labels. |
| `agentgateway_tls_handshake_duration_seconds` | Histogram | seconds | Duration to complete inbound TLS/HTTPS handshake (seconds). |
| `agentgateway_upstream_connect_duration_seconds` | Histogram | seconds | Duration to establish upstream connection (seconds). |

## MCP

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_mcp_requests_total` | Counter | — | Total number of MCP requests. |

## LLM

These metrics follow the [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/). 

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_cost_catalog_lookups_total` | Counter | — | Total number of model cost catalog lookups by resolution status. |
| `agentgateway_gen_ai_client_cost_usd_total` | Counter | usd | Cumulative USD cost of generative AI requests. |
| `agentgateway_gen_ai_client_token_usage` | Histogram | — | Number of tokens used per request. |
| `agentgateway_gen_ai_server_request_duration` | Histogram | — | Duration of generative AI request. |
| `agentgateway_gen_ai_server_time_per_output_token` | Histogram | — | Time to generate each output token for a given request. |
| `agentgateway_gen_ai_server_time_to_first_token` | Histogram | — | Time to generate the first token for a given request. |
| `agentgateway_guardrail_checks_total` | Counter | — | Total number of guardrail checks. |

## Misc

The following metrics reflect the health of the agentgateway process itself and appear on every startup, regardless of traffic.

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_build_info` | Info | — | Agentgateway build information. |
| `agentgateway_config_synchronized` | Gauge | — | Whether the last configuration load/reload was successful or not, being synchronized with the on-disk configuration. |
| `agentgateway_upstream_call_duration_seconds` | Histogram | seconds | Duration of outbound calls made by agentgateway (seconds). |


