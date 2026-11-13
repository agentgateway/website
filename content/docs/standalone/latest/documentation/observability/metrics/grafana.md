---
title: Grafana
weight: 40
description: Visualize standalone agentgateway metrics in Grafana with the pre-built dashboard for binary, Docker, and Helm deployments.
aliases:
  - ../../../integrations/observability/grafana/
---

[Grafana](https://grafana.com/) is an open-source visualization platform that turns time-series data into dashboards, graphs, and alerts. It is the standard way to visualize agentgateway metrics that are collected by [Prometheus]({{< link-hextra path="/documentation/observability/metrics/prometheus/" >}}), and supports correlating metrics with traces by adding Jaeger as a second data source in the same Grafana instance.

Agentgateway ships a pre-built standalone dashboard for binary, Docker, and standalone Helm deployments. It covers requests, latency, LLM traffic, MCP traffic, and runtime statistics without requiring Kubernetes namespace, gateway, or pod labels.

Use the [PromQL queries](#common-promql-queries) to add custom panels or alerts.

## Before you begin

[Set up a Prometheus instance]({{< link-hextra path="/documentation/observability/metrics/prometheus/" >}}) so that you can start collecting metrics and feeding them into Grafana. Do not run that guide's cleanup step until you finish this one, if you use the Kubernetes installation steps, because both guides use the `monitoring` namespace.

> [!NOTE]
> The `kube-prometheus-stack` chart already installs Grafana as the `kube-prometheus-stack-grafana` service. If you set up Prometheus with that chart, skip steps 1 through 3 and port-forward `svc/kube-prometheus-stack-grafana` instead. Get its admin password with `kubectl get secret -n monitoring kube-prometheus-stack-grafana -o jsonpath="{.data.admin-password}" | base64 --decode`.

## Use Grafana in Kubernetes

The standalone dashboard includes request rates by status, route, and reason; request latency; LLM token usage, time to first token, and inter-chunk latency; MCP calls; and runtime statistics. The Kubernetes control-plane dashboard is a separate dashboard that requires Kubernetes labels.

1. Add the Grafana Helm repository and install Grafana.
   ```sh
   helm repo add grafana https://grafana.github.io/helm-charts
   helm install grafana grafana/grafana -n monitoring --create-namespace
   ```

2. Verify that the Grafana pod is running.
   ```sh
   kubectl get pods -n monitoring
   ```

3. Get the Grafana admin password.
   ```sh
   kubectl get secret -n monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode
   ```

4. Forward the Grafana port to access the UI.
   ```sh
   kubectl port-forward -n monitoring svc/grafana 3001:80
   ```

5. Access Grafana at [http://localhost:3001](http://localhost:3001). Log in with the `admin` username and the password that you created in the previous step.

6. Add a Prometheus data source.
   1. Go to **Connections** → **Add new connection**.
   2. Search for and select the **Prometheus** plugin, then click **Add new data source**.
   3. Set the URL to your in-cluster Prometheus service, such as `http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090`.
   4. Click **Save & Test**.

7. Download the agentgateway dashboard JSON.
   ```sh
   curl -L "https://raw.githubusercontent.com/agentgateway/agentgateway/v1.7.0/controller/install/helm/agentgateway-standalone/files/agentgateway-dashboard.json" \
     -o agentgateway-dashboard.json
   ```

8. In Grafana, go to **Dashboards** → **New** → **Import**.

9. Click **Upload dashboard JSON file** and select the `agentgateway-dashboard.json` file.

10. Select your Prometheus data source and click **Import**.

11. When you are done, remove Grafana and the monitoring namespace.
    ```sh
    helm uninstall grafana -n monitoring
    kubectl delete namespace monitoring
    ```

## Use Grafana with binary or Docker

1. Run Grafana with Docker.

   ```bash
   docker run -d --name grafana \
     -p 3001:3000 \
     grafana/grafana:latest
   ```

2. Access the Grafana UI at [http://localhost:3001](http://localhost:3001). Use the `admin` username and `admin` password to log into Grafana.

3. Add a Prometheus data source.
   1. Go to **Connections** → **Add new connection**.
   2. Search for and select the **Prometheus** plugin, then click **Add new data source**.
   3. Set the Prometheus server URL to `http://host.docker.internal:9090`.
   4. Click **Save & Test**.

4. Download and import the standalone dashboard.

   ```sh
   curl -L "https://raw.githubusercontent.com/agentgateway/agentgateway/v1.7.0/controller/install/helm/agentgateway-standalone/files/agentgateway-dashboard.json" \
     -o agentgateway-dashboard.json
   ```

   In Grafana, go to **Dashboards** → **New** → **Import**, upload the JSON file, select your Prometheus data source, and click **Import**. The dashboard does not require Kubernetes labels on your metrics.

   To add your own panels, select **New dashboard**, add a visualization, and enter one of the [Common PromQL queries](#common-promql-queries) in the query editor's **Code** view.

5. When you are done, remove the Grafana container.
   ```sh
   docker rm -f grafana
   ```

## Common PromQL queries

Use these queries to build custom panels or alerts. To enter a raw PromQL query in Grafana, switch the query editor from **Builder** to **Code** mode by using the toggle in the query section.

| Use case | PromQL query |
|----------|-------------|
| Request rate | `rate(agentgateway_requests_total[5m])` |
| Error rate | `rate(agentgateway_requests_total{status=~"5.."}[5m]) / rate(agentgateway_requests_total[5m])` |
| LLM token usage (input) | `sum by (gen_ai_system, gen_ai_request_model) (rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[5m]))` |
| Time to first token (p95) | `histogram_quantile(0.95, rate(agentgateway_gen_ai_server_time_to_first_token_bucket[5m]))` |
| MCP tool call rate by tool | `sum by (server, resource) (rate(agentgateway_mcp_requests_total{method="tools/call"}[5m]))` |

## Add a Jaeger data source for traces

To correlate metrics with traces in the same Grafana instance:

1. Go to **Connections** → **Add new connection**.
2. Search for and select the **Jaeger** plugin, then click **Add new data source**.
3. Set the URL to your Jaeger instance, such as `http://jaeger:16686`.
4. Click **Save & Test**.