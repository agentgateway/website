
The agentgateway control plane exposes Prometheus-compatible metrics on port `9092`. These metrics reflect the health and activity of the Kubernetes controller, such as how many resources have been reconciled, how long reconciliations take, and whether the controller is keeping the XDS snapshot in sync with the proxy.

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

   Example output:
   ```console
   # HELP agentgateway_controller_reconciliations_total Total number of controller reconciliations
   # TYPE agentgateway_controller_reconciliations_total counter
   agentgateway_controller_reconciliations_total{controller="gateway",result="success"} 1
   agentgateway_controller_reconciliations_total{controller="gatewayclass",result="success"} 2
   agentgateway_controller_reconciliations_total{controller="gatewayclass-provisioner",result="success"} 2
   ```

3. Enable metrics scraping for control plane metrics with the OTel stack so that you can export and visualize metrics in monitoring tools, such as Prometheus and Grafana. For more information, see [Scrape metrics for querying and visualization]({{< link path="/documentation/observability/metrics/overview/#scrape-metrics-for-querying-and-visualization" >}}). 

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

