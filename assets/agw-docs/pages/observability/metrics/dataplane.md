{{< reuse "agw-docs/pages/observability/metrics/dataplane-intro.md" >}}

## Data plane metrics reference

> [!NOTE]
> Counter and histogram metrics only appear after the first request of that type. For example, `agentgateway_mcp_requests_total` is not present until MCP traffic is received. This is normal Prometheus behavior — counters and histograms are not pre-initialized.

### XDS

These metrics track communication with the agentgateway control plane over XDS. They are only present when agentgateway runs in Kubernetes mode and do not appear on a standalone process.

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_xds_connection_terminations_total` | Counter | — | The total number of completed connections to xds server (unstable). |
| `agentgateway_xds_message_bytes_total` | Counter | bytes | Total number of bytes received (unstable). |
| `agentgateway_xds_message_total` | Counter | — | Total number of messages received (unstable). |

### HTTP

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_request_duration_seconds` | Histogram | seconds | Duration of HTTP requests. |
| `agentgateway_request_processing_seconds` | Histogram | seconds | Duration from receiving an HTTP request to sending the primary outbound call. |{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" >}}
| `agentgateway_requests_active` | Gauge | — | HTTP requests waiting for a complete backend response. |{{< /version >}}
| `agentgateway_requests_shed_total` | Counter | — | Total downstream requests rejected by the in-flight request limit. |
| `agentgateway_requests_total` | Counter | — | The total number of HTTP requests sent. |
| `agentgateway_response_bytes_total` | Counter | bytes | Total HTTP response bytes received. |
| `agentgateway_response_processing_seconds` | Histogram | seconds | Duration from receiving the primary outbound response to sending the HTTP response. |
| `agentgateway_retries_total` | Counter | — | The total number of request retries. |

### TCP

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_downstream_connections_shed_total` | Counter | — | Total downstream connections closed by the active connection limit. |
| `agentgateway_downstream_connections_total` | Counter | — | The total number of downstream connections established. |
| `agentgateway_downstream_received_bytes_total` | Counter | bytes | Total TCP bytes received per connection labels. |
| `agentgateway_downstream_sent_bytes_total` | Counter | bytes | Total TCP bytes transmitted per connection labels. |
| `agentgateway_tls_handshake_duration_seconds` | Histogram | seconds | Duration to complete inbound TLS/HTTPS handshake. |
| `agentgateway_upstream_connect_duration_seconds` | Histogram | seconds | Duration to establish upstream connection. |{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" >}}
| `agentgateway_upstream_connections_active` | Gauge | — | Open upstream connections by backend. |{{< /version >}}

### MCP

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_mcp_requests_total` | Counter | — | Total number of MCP requests.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" >}} The `outcome` label records how each request ended.{{< /version >}} |

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" >}}

{{< reuse "agw-docs/pages/observability/metrics/dataplane-mcp-outcome.md" >}}

{{< /version >}}

### LLM

These metrics follow the [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/).

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_cost_catalog_lookups_total` | Counter | — | Total number of model cost catalog lookups by resolution status. |
| `agentgateway_gen_ai_client_cost_usd_total` | Counter | usd | Cumulative USD cost of generative AI requests. |
| `agentgateway_gen_ai_client_token_usage` | Histogram | — | Number of tokens used per request. |{{< version include-if="1.5.x" >}}
| `agentgateway_gen_ai_server_request_duration` | Histogram | — | Duration of generative AI request. |{{< /version >}}{{< version exclude-if="1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
| `agentgateway_gen_ai_server_request_duration` | Histogram | — | Duration of a generative AI request in seconds. Failed operations have `error_type="_OTHER"` and successful operations omit the label. |{{< /version >}}
| `agentgateway_gen_ai_server_time_per_output_token` | Histogram | — | Time to generate each output token for a given request. |
| `agentgateway_gen_ai_server_time_to_first_token` | Histogram | — | Time to generate the first token for a given request. |{{< version exclude-if="1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
| `agentgateway_gen_ai_server_inter_chunk_latency` | Histogram | seconds | Time between consecutive streamed output chunks, observed for each chunk after the first. Shows the distribution of gaps within a response, unlike the per-request average in `time_per_output_token`. |{{< /version >}}
| `agentgateway_guardrail_checks_total` | Counter | — | Total number of guardrail checks. |

{{< reuse "agw-docs/pages/observability/metrics/dataplane-runtime.md" >}}

### Misc

The following metrics reflect the health of the agentgateway process and appear on every startup regardless of traffic.

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_build_info` | Info | — | Agentgateway build information. |
| `agentgateway_config_synchronized` | Gauge | — | Whether the last configuration load or reload was successful. |
| `agentgateway_upstream_call_duration_seconds` | Histogram | seconds | Duration of outbound calls made by agentgateway. |

{{< reuse "agw-docs/pages/observability/metrics/dataplane-queries.md" >}}
