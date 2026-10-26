
The agentgateway control plane exposes Prometheus-compatible metrics on port `9092`. They track resource reconciliation counts, {{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}reconciliation duration, {{< /version >}}and XDS synchronization with the proxy.

Control plane metrics cannot be customized. To set up automatic scraping of these metrics with Prometheus, see [Enable metrics scraping]({{< link path="/documentation/observability/metrics/overview/" >}}).

## View control plane metrics

1. Port-forward the control plane deployment.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} deployment/{{< reuse "agw-docs/snippets/pod-name.md" >}} 9092:9092
   ```

2. Query the metrics endpoint.

   ```sh
   curl http://localhost:9092/metrics
   ```

   {{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
   Example output:

   ```console
   # HELP agentgateway_controller_reconciliations_total Total number of controller reconciliations
   # TYPE agentgateway_controller_reconciliations_total counter
   agentgateway_controller_reconciliations_total{controller="gateway",result="success"} 1
   agentgateway_controller_reconciliations_total{controller="gatewayclass",result="success"} 2
   agentgateway_controller_reconciliations_total{controller="gatewayclass-provisioner",result="success"} 2
   ```
   {{< /version >}}
   {{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
   Example output:

   ```console
   # HELP agentgateway_controller_reconciliations_total Total number of controller reconciliations
   # TYPE agentgateway_controller_reconciliations_total counter
   agentgateway_controller_reconciliations_total{controller="gateway",result="error"} 14
   agentgateway_controller_reconciliations_total{controller="gateway",result="success"} 62
   agentgateway_controller_reconciliations_total{controller="gatewayclass",result="success"} 2
   ```
   {{< /version >}}

3. Enable metrics scraping for control plane metrics with the OTel stack so that you can export and visualize metrics in monitoring tools, such as Prometheus and Grafana. For more information, see [Scrape metrics for querying and visualization]({{< link path="/documentation/observability/metrics/overview/" >}}).

{{< doc-test paths="control-plane-metrics" >}}
YAMLTest -f - <<'EOF'
- name: Control plane metrics endpoint returns HTTP 200
  retries: 3
  http:
    url: "http://localhost:9092/metrics"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

## Control plane metrics reference

Review the metrics that are emitted by the {{< reuse "agw-docs/snippets/agentgateway.md" >}} control plane. 
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}

The following metrics and labels have changed:

- **Removed metrics**: The `agentgateway_controller_reconcile_duration_seconds` histogram and `agentgateway_controller_reconciliations_running` gauge.
- **Counter labels**: `agentgateway_controller_reconciliations_total` keeps only `controller` and `result`. The `name` and `namespace` labels are removed.

For the `gateway` controller, the counter includes only Gateways whose GatewayClass the {{< reuse "agw-docs/snippets/agentgateway.md" >}} controller manages.

Update dashboards, alerts, or recording rules that use the removed metrics or labels.

{{< /version >}}

