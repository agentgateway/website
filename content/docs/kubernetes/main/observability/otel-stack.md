---
title: OTel stack
weight: 10
---

{{< reuse "agw-docs/snippets/agentgateway/otel-prereq.md" >}}

{{< reuse "agw-docs/pages/observability/otel-stack.md" >}}

## Step 4: Explore Grafana dashboards

{{< reuse "agw-docs/snippets/agentgateway/grafana-dashboards.md" >}}


## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Remove the configmap for the Envoy gateway proxy dashboard and delete the `envoy.json` file.
   ```sh
   kubectl delete cm {{< reuse "agw-docs/snippets/pod-name.md" >}}-dashboard -n telemetry
   rm {{< reuse "agw-docs/snippets/pod-name.md" >}}.json
   ```

2. Uninstall the Grafana Loki and Tempo components. 
   ```sh
   helm uninstall loki -n telemetry
   helm uninstall tempo -n telemetry
   ```

3. Uninstall the OpenTelemetry collectors. 
   ```sh
   helm uninstall opentelemetry-collector-metrics -n telemetry
   helm uninstall opentelemetry-collector-logs -n telemetry
   helm uninstall opentelemetry-collector-traces -n telemetry
   ```

4. Uninstall the Prometheus stack. 
   ```sh
   helm uninstall kube-prometheus-stack -n telemetry
   ```

5. Remove the `telemetry` namespace. 
   ```sh
   kubectl delete namespace telemetry
   ```