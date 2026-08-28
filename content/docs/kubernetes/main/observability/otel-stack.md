---
title: OTel stack
description: Install an OpenTelemetry stack with Grafana, Loki, and Tempo for observability.
weight: 5
test:
  otel-stack:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/observability/otel-stack.md
    path: otel-stack
---

{{< reuse "agw-docs/snippets/agentgateway/otel-prereq.md" >}}

{{< reuse "agw-docs/pages/observability/otel-stack.md" >}}

## Step 5: Explore Grafana dashboards

When you enabled `monitoring.enabled` in the previous step, the {{< reuse "agw-docs/snippets/agentgateway.md" >}} Helm chart created a ConfigMap resource with a pre-built Grafana dashboard in the `{{< reuse "agw-docs/snippets/namespace.md" >}}` namespace. Because the Grafana sidecar is configured with `searchNamespace: ALL` (from Step 3), it discovers and loads this dashboard automatically into the Grafana dashboard. No manual import of the dashboard is needed. 

{{< doc-test paths="otel-stack" >}}
YAMLTest -f - <<'EOF'
# Confirm that Grafana auto-loaded the Agentgateway dashboard from the ConfigMap created
# by monitoring.enabled in Step 4. The Authorization header is "admin:prom-operator"
# (the default Grafana credentials) base64-encoded for HTTP basic auth.
- name: Agentgateway dashboard is loaded in Grafana
  retries: 30
  http:
    url: "http://localhost:3000/api/dashboards/uid/agentgateway"
    method: GET
    headers:
      authorization: "Basic YWRtaW46cHJvbS1vcGVyYXRvcg=="
  source:
    type: pod
    usePortForward: true
    selector:
      kind: Deployment
      metadata:
        namespace: telemetry
        name: kube-prometheus-stack-grafana
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.dashboard.title"
        comparator: contains
        value: Agentgateway
EOF
{{< /doc-test >}}

1. Open and log in to Grafana with the username `admin` and password `prom-operator`.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   open "http://$(kubectl -n telemetry get svc kube-prometheus-stack-grafana -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}"):3000"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   1. Port-forward the Grafana service to your local machine.
      ```sh
      kubectl port-forward deployment/kube-prometheus-stack-grafana -n telemetry 3000
      ```
   2. Open Grafana in your browser at [http://localhost:3000](http://localhost:3000).

   3. Log in to Grafana with the `admin` username and `prom-operator` password.
   {{% /tab %}}
   {{< /tabs >}}

2. Go to **Dashboards** > **Agentgateway** to open the pre-built dashboard. Verify that you see metrics, such as the proxy overview of CPU and memory usage, request rate by gateway, LLM token consumption, or MCP tool calls.

   {{< reuse-image-light src="img/agentgateway-dashboard.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-dashboard.png" >}}

   {{< reuse "agw-docs/snippets/agentgateway/grafana-dashboard-metrics.md" >}}

## What's next

The OTel stack provides the storage and visualization layer. Use the following guides to configure the agentgateway proxy to send each type of telemetry data to the stack.

### Metrics

{{< cards >}}
  {{< card path="/observability/metrics/overview/#other-proxies" title="Scrape additional proxies" >}}
  {{< card path="/observability/metrics/overview/#grafana-dashboard-discovery" title="Configure dashboard discovery" >}}
{{< /cards >}}

### Access logs

{{< cards >}}
  {{< card path="/observability/access-logs/export/" title="Export access logs" >}}
{{< /cards >}}

### Traces

{{< cards >}}
  {{< card path="/observability/traces/setup/" title="Set up traces" >}}
  {{< card path="/observability/traces/setup/#sampling" title="Customize traces" >}}
{{< /cards >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Uninstall the Grafana Loki and Tempo components.
   ```sh
   helm uninstall loki -n telemetry
   helm uninstall tempo -n telemetry
   ```

2. Disable monitoring and uninstall the OpenTelemetry collectors.
   ```sh
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-agentgateway.md" >}} \
     {{< reuse "agw-docs/snippets/helm-path.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     --reuse-values \
     --set monitoring.enabled=false
   helm uninstall opentelemetry-collector-logs -n telemetry
   helm uninstall opentelemetry-collector-traces -n telemetry
   ```

3. Uninstall the Prometheus stack.
   ```sh
   helm uninstall kube-prometheus-stack -n telemetry
   ```

4. Remove the `telemetry` namespace.
   ```sh
   kubectl delete namespace telemetry
   ```