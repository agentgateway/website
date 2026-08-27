---
title: Grafana
weight: 40
description: Visualize agentgateway metrics in Grafana by using the pre-built Kubernetes dashboard or custom PromQL panels for binary and Docker deployments.
test:
  grafana:
  - file: ${versionRoot}/observability/metrics/grafana.md
    path: grafana
---

[Grafana](https://grafana.com/) is an open-source visualization platform that turns time-series data into dashboards, graphs, and alerts. It is the standard way to visualize agentgateway metrics that are collected by [Prometheus]({{< link-hextra path="/observability/metrics/prometheus/" >}}), and supports correlating metrics with traces by adding Jaeger as a second data source in the same Grafana instance.

Agentgateway ships a pre-built dashboard for Kubernetes deployments that covers requests, LLM traffic, MCP traffic, and connections out of the box.

For binary and Docker deployments where the pre-built dashboard does not apply, you can use the [PromQL queries](#common-promql-queries) that are included in this guide to help you get started with building your own Grafana panels.

## Before you begin

[Set up a Prometheus instance]({{< link-hextra path="/observability/metrics/prometheus/" >}}) so that you can start collecting metrics and feeding them into Grafana. Do not run that guide's cleanup step until you finish this one, because both guides use the `monitoring` namespace.

> [!NOTE]
> The `kube-prometheus-stack` chart already installs Grafana as the `kube-prometheus-stack-grafana` service. If you set up Prometheus with that chart, skip steps 1 through 3 and port-forward `svc/kube-prometheus-stack-grafana` instead. Get its admin password with `kubectl get secret -n monitoring kube-prometheus-stack-grafana -o jsonpath="{.data.admin-password}" | base64 --decode`.

## Use the pre-built Grafana dashboard (Kubernetes only)

The pre-built dashboard includes the following sections:

{{< reuse "agw-docs/snippets/agentgateway/grafana-dashboard-metrics.md" >}}

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
   curl -L "https://raw.githubusercontent.com/agentgateway/agentgateway/main/controller/install/helm/agentgateway/files/agentgateway-dashboard.json" \
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

## Build your own Grafana panels (Binary and Docker)

1. Run Grafana with Docker.

   ```bash {paths="grafana"}
   docker run -d --name grafana \
     -p 3001:3000 \
     grafana/grafana:latest
   ```

   {{< doc-test paths="grafana" >}}
   # ============================================================================
   # Doc test coverage for this guide (these comments are not rendered on the page)
   # ============================================================================
   # WHAT THIS TEST VALIDATES:
   #   * Step 1: the docker run command starts Grafana and its API becomes healthy.
   #   * "Use the pre-built Grafana dashboard" step 7: the curl download URL resolves and
   #     returns valid JSON whose `uid` is "agentgateway".
   #   * Dashboard import (proxy for the manual UI steps 8-10): the dashboard imports into the
   #     running Grafana through the API, and Grafana loads it.
   #
   # WHAT THIS TEST DOES NOT VALIDATE (and why):
   #   * "Add a Prometheus data source" - UI-only; no Prometheus is running in the test.
   #   * PromQL query examples - display-only, no metrics source.
   #   * The manual "Upload dashboard JSON file" UI import - UI-only; the test imports the same
   #     JSON through the Grafana API as a proxy.
   #   * That the dashboard panels render data - no agentgateway/Prometheus is wired up.
   # ============================================================================
   # Wait for the Grafana API to become available, then clean up when the test exits.
   trap 'docker rm -f grafana >/dev/null 2>&1; rm -f agentgateway-dashboard.json' EXIT
   for i in $(seq 1 30); do
     curl -sf http://localhost:3001/api/health >/dev/null 2>&1 && break
     sleep 2
   done
   # Confirm that the dashboard JSON downloaded in the Kubernetes section is the expected
   # agentgateway dashboard, then import it through the API to mirror the manual
   # "Upload dashboard JSON file" step.
   curl -sL "https://raw.githubusercontent.com/agentgateway/agentgateway/main/controller/install/helm/agentgateway/files/agentgateway-dashboard.json" \
     -o agentgateway-dashboard.json
   jq -e '.uid == "agentgateway"' agentgateway-dashboard.json >/dev/null
   jq '{dashboard: ., overwrite: true}' agentgateway-dashboard.json \
     | curl -sf -u admin:admin -H "Content-Type: application/json" \
         -X POST http://localhost:3001/api/dashboards/db -d @- >/dev/null
   {{< /doc-test >}}

   {{< doc-test paths="grafana" >}}
   YAMLTest -f - <<'EOF'
   # Confirm that Grafana loaded the imported Agentgateway dashboard. The Authorization header is
   # "admin:admin" (the default Grafana credentials) base64-encoded for basic auth.
   - name: Agentgateway dashboard is loaded in Grafana
     retries: 10
     http:
       url: "http://localhost:3001/api/dashboards/uid/agentgateway"
       method: GET
       headers:
         authorization: "Basic YWRtaW46YWRtaW4="
     source:
       type: local
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.dashboard.title"
           comparator: contains
           value: Agentgateway
   EOF
   {{< /doc-test >}}

2. Access the Grafana UI at [http://localhost:3001](http://localhost:3001). Use the `admin` username and `admin` password to log into Grafana.

3. Add a Prometheus data source.
   1. Go to **Connections** → **Add new connection**.
   2. Search for and select the **Prometheus** plugin, then click **Add new data source**.
   3. Set the Prometheus server URL to `http://host.docker.internal:9090`.
   4. Click **Save & Test**.

4. Create a dashboard.
   1. Go to **Dashboards** → **New** → **New dashboard**.
   2. Add a Panel and click **Configure visualization**.
   3. Select your Prometheus data source.
   4. Switch to the **Code** view and enter a PromQL query in the query editor. For example, to see request rate by route:
      ```promql
      rate(agentgateway_requests_total[5m])
      ```
   5. Click **Apply** to save the panel, then save the dashboard.

   For more queries to build out your dashboard, see [Common PromQL queries](#common-promql-queries).

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