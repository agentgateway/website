
The agentgateway proxy exposes a Prometheus-compatible metrics endpoint on port `15020`. Metrics are collected automatically for every request that passes through the gateway and follow the [OpenMetrics](https://openmetrics.io/) format. All agentgateway metrics use the `agentgateway_` prefix.

To set up automatic scraping of these metrics with Prometheus, see [Enable metrics scraping]({{< link path="/observability/metrics/overview/" >}}).

## View data plane metrics

1. Port-forward the agentgateway proxy.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} deploy/agentgateway-proxy 15020:15020
   ```

2. Query the metrics endpoint.

   ```sh
   curl http://localhost:15020/metrics
   ```

3. Enable metrics scraping for data plane metrics with the OTel stack so that you can export and visualize metrics in monitoring tools, such as Prometheus and Grafana. For more information, see [Scrape metrics for querying and visualization]({{< link path="/observability/metrics/overview/#scrape-metrics-for-querying-and-visualization" >}}). 

## Add custom metric labels

You can enrich all metrics with custom labels computed from [CEL]({{< link path="/reference/cel/" >}}) expressions by using an {{< reuse "agw-docs/snippets/policy.md" >}}. Labels are added to every metric that carries route identifier labels.

The following example adds two labels to all metrics:
- `team`: A dynamic label computed from a JWT claim, so each metric reflects the team that owns the request.
- `org`: A dynamic label read from the `x-org-id` request header.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: metrics-labels
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  frontend:
    metrics:
      attributes:
        add:
        - name: team
          expression: jwt.team
        - name: org
          expression: 'request.headers["x-org-id"]'
EOF
```

> [!WARNING]
> High-cardinality labels, such as per-user IDs, can significantly increase Prometheus storage and memory usage. Prefer low-cardinality dimensions such as team or environment.

> [!NOTE]
> The Kubernetes API only supports adding labels. Removing default metric labels or an entire metric is not supported via {{< reuse "agw-docs/snippets/policy.md" >}} resource.

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
| `agentgateway_request_processing_seconds` | Histogram | seconds | Duration from receiving an HTTP request to sending the primary outbound call. |
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
| `agentgateway_upstream_connect_duration_seconds` | Histogram | seconds | Duration to establish upstream connection. |

### MCP

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_mcp_requests_total` | Counter | — | Total number of MCP requests. |

### LLM

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

### Cgroup memory

These metrics track Linux cgroup v2 memory statistics for the agentgateway process. They are available whenever agentgateway runs in a Linux environment, including standalone deployments, and are not specific to Kubernetes mode.

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_cgroup_usage` | Gauge | bytes | Current memory usage. |
| `agentgateway_cgroup_working_set` | Gauge | bytes | Current working set. |
| `agentgateway_cgroup_anon` | Gauge | bytes | Current anonymous memory usage. |
| `agentgateway_cgroup_active_anon` | Gauge | bytes | Current active anonymous memory usage. |
| `agentgateway_cgroup_inactive_anon` | Gauge | bytes | Current inactive anonymous memory usage. |
| `agentgateway_cgroup_file` | Gauge | bytes | Current file memory usage. |
| `agentgateway_cgroup_file_mapped` | Gauge | bytes | Current mapped file memory usage. |
| `agentgateway_cgroup_active_file` | Gauge | bytes | Current active file memory usage. |
| `agentgateway_cgroup_inactive_file` | Gauge | bytes | Current inactive file memory usage. |
| `agentgateway_cgroup_shmem` | Gauge | bytes | Current shared memory usage. |
| `agentgateway_cgroup_kernel` | Gauge | bytes | Current kernel memory usage. |
| `agentgateway_cgroup_kernel_stack` | Gauge | bytes | Current kernel stack memory usage. |
| `agentgateway_cgroup_pagetables` | Gauge | bytes | Current page tables memory usage. |
| `agentgateway_cgroup_percpu` | Gauge | bytes | Current per-CPU memory usage. |
| `agentgateway_cgroup_sock` | Gauge | bytes | Current socket memory usage. |
| `agentgateway_cgroup_slab` | Gauge | bytes | Current slab memory usage. |
| `agentgateway_cgroup_slab_reclaimable` | Gauge | bytes | Current reclaimable slab memory usage. |
| `agentgateway_cgroup_slab_unreclaimable` | Gauge | bytes | Current unreclaimable slab memory usage. |
| `agentgateway_cgroup_pgfault_total` | Counter | — | Total cgroup page faults. |
| `agentgateway_cgroup_pgmajfault_total` | Counter | — | Total cgroup major page faults. |
| `agentgateway_cgroup_workingset_refault_anon_total` | Counter | — | Total anonymous working set refaults. |
| `agentgateway_cgroup_workingset_refault_file_total` | Counter | — | Total file working set refaults. |
| `agentgateway_cgroup_workingset_activate_anon_total` | Counter | — | Total anonymous working set activations. |
| `agentgateway_cgroup_workingset_activate_file_total` | Counter | — | Total file working set activations. |
| `agentgateway_cgroup_workingset_restore_anon_total` | Counter | — | Total anonymous working set restores. |
| `agentgateway_cgroup_workingset_restore_file_total` | Counter | — | Total file working set restores. |

### Process memory

These metrics track process-level memory for the agentgateway process, sourced from `/proc/self/smaps`. They are available whenever agentgateway runs in a Linux environment, including standalone deployments, and are not specific to Kubernetes mode.

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_process_rss` | Gauge | bytes | RSS (resident set size) memory usage. |
| `agentgateway_process_pss` | Gauge | bytes | PSS (proportional set size) memory usage. |
| `agentgateway_process_pss_dirty` | Gauge | bytes | Dirty PSS memory usage. |
| `agentgateway_process_shared_clean` | Gauge | bytes | Shared clean memory usage. |
| `agentgateway_process_shared_dirty` | Gauge | bytes | Shared dirty memory usage. |
| `agentgateway_process_private_clean` | Gauge | bytes | Private clean memory usage. |
| `agentgateway_process_private_dirty` | Gauge | bytes | Private dirty memory usage. |
| `agentgateway_process_referenced` | Gauge | bytes | Referenced memory usage. |
| `agentgateway_process_anonymous` | Gauge | bytes | Anonymous memory usage. |
| `agentgateway_process_lazy_free` | Gauge | bytes | Lazy free memory. |
| `agentgateway_process_anon_huge_pages` | Gauge | bytes | Anonymous huge pages usage. |
| `agentgateway_process_shmem_huge_pages` | Gauge | bytes | Shared memory huge pages usage. |
| `agentgateway_process_shmem_pmd_mapped` | Gauge | bytes | Shared memory PMD-mapped usage. |
| `agentgateway_process_file_pmd_mapped` | Gauge | bytes | File PMD-mapped usage. |
| `agentgateway_process_shared_hugetlb` | Gauge | bytes | Shared hugetlb usage. |
| `agentgateway_process_private_hugetlb` | Gauge | bytes | Private hugetlb usage. |
| `agentgateway_process_swap` | Gauge | bytes | Process swap usage. |
| `agentgateway_process_swap_pss` | Gauge | bytes | Process proportional swap usage. |
| `agentgateway_process_locked` | Gauge | bytes | Process locked memory usage. |

### Misc

The following metrics reflect the health of the agentgateway process and appear on every startup regardless of traffic.

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_build_info` | Info | — | Agentgateway build information. |
| `agentgateway_config_synchronized` | Gauge | — | Whether the last configuration load or reload was successful. |
| `agentgateway_upstream_call_duration_seconds` | Histogram | seconds | Duration of outbound calls made by agentgateway. |
| `agentgateway_tokio_num_workers` | Gauge | — | The number of worker threads the async runtime uses. |
| `agentgateway_tokio_num_alive_tasks` | Gauge | — | The number of tasks currently alive in the async runtime. |
| `agentgateway_tokio_global_queue_depth` | Gauge | — | The number of tasks currently scheduled in the async runtime's global queue. |

## Example PromQL queries

Use these queries in Prometheus or as the basis for Grafana panels and alerts. To enter a raw PromQL query in Grafana, switch the query editor from **Builder** to **Code** mode.

| Use case | PromQL query |
| --- | --- |
| Request rate | `rate(agentgateway_requests_total[5m])` |
| Error rate | `rate(agentgateway_requests_total{status=~"5.."}[5m]) / rate(agentgateway_requests_total[5m])` |
| LLM token usage (input) | `sum by (gen_ai_system, gen_ai_request_model) (rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[5m]))` |
| Time to first token (p95) | `histogram_quantile(0.95, rate(agentgateway_gen_ai_server_time_to_first_token_bucket[5m]))` |
| MCP tool call rate by tool | `sum by (server, resource) (rate(agentgateway_mcp_requests_total{method="tools/call"}[5m]))` |
