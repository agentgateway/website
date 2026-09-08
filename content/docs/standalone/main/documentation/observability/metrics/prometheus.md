---
title: Prometheus
weight: 30
description: Scrape agentgateway metrics with Prometheus.
aliases:
  - /docs/standalone/main/integrations/observability/prometheus/
---

[Prometheus](https://prometheus.io/) is an open-source monitoring system that scrapes and stores time-series metrics. It is the standard way to collect and query agentgateway metrics, and is the data source behind the [Grafana dashboard]({{< link-hextra path="/documentation/observability/metrics/grafana/" >}}). Prometheus is well-suited for agentgateway because it efficiently handles high-cardinality label sets, such as per-route, per-model, and per-provider breakdowns. Its query language (PromQL) makes it easy to build alerts and dashboards from those labels.

Agentgateway is built to work with Prometheus out of the box:

- It exposes a `/metrics` endpoint on port `15020` in the [OpenMetrics](https://openmetrics.io/) format, which Prometheus can scrape directly.
- All metrics use the `agentgateway_` prefix and carry consistent route identifier labels so you can filter and aggregate by gateway, listener, and route without additional configuration.
- On Kubernetes, the agentgateway chart annotates proxy pods with `prometheus.io/scrape: "true"` and `prometheus.io/port: "15020"` for Prometheus installs that use annotation-based discovery, and ships an optional `PodMonitor` for installs that run the Prometheus Operator.

## Set up Prometheus

Set up a Prometheus instance and use PromQL queries to query them. The steps to set up Prometheus vary depending on the way you installed agentgateway. 

{{< tabs >}}
{{% tab name="Binary and Docker" %}}

1. Create a Prometheus configuration file that scrapes agentgateway.

   ```yaml
   cat > prometheus.yml <<EOF
   scrape_configs:
     - job_name: agentgateway
       static_configs:
         - targets:
             - host.docker.internal:15020
       scrape_interval: 15s
   EOF
   ```

2. Run Prometheus with Docker.

   ```sh
   docker run -d --name prometheus \
     -p 9090:9090 \
     -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
     prom/prometheus:latest
   ```

3. Open the Prometheus UI at [http://localhost:9090](http://localhost:9090).

4. Run a PromQL query to verify that agentgateway metrics are being scraped. In the Prometheus UI, enter the following query and click **Execute**.

   ```promql
   agentgateway_requests_total
   ```

   The result shows the total number of requests that are handled by agentgateway, broken down by gateway, listener, route, and status.

   {{< reuse-image src="img/prometheus-query.png" srcDark="img/prometheus-query-dark.png"  >}}

5. When you are done, remove the Prometheus container.

   ```sh
   docker rm -f prometheus
   ```

{{% /tab %}}
{{% tab name="Kubernetes (Helm)" %}}

The recommended way to run Prometheus on Kubernetes is with the `kube-prometheus-stack` Helm chart, which installs Prometheus, Alertmanager, and Grafana together.

The Prometheus Operator that this chart installs discovers scrape targets through `PodMonitor` and `ServiceMonitor` resources, not through the `prometheus.io/scrape` pod annotations. To scrape agentgateway, enable the `PodMonitor` that the agentgateway chart ships, and label it with the Prometheus release name so that the operator selects it.

1. Add the Prometheus community Helm repository.

   ```sh
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm repo update
   ```

2. Install the `kube-prometheus-stack` chart.

   ```sh
   helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
     -n monitoring --create-namespace
   ```

3. Verify that the pods are running.

   ```sh
   kubectl get pods -n monitoring
   ```

4. Enable the agentgateway `PodMonitor` so that Prometheus scrapes the proxy's metrics endpoint. The `release` label must match the name of your `kube-prometheus-stack` release.

   ```sh
   helm upgrade -i {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     --reuse-values \
     --set monitoring.enabled=true \
     --set monitoring.extraLabels.release=kube-prometheus-stack
   ```

5. Verify that the `PodMonitor` was created.

   ```sh
   kubectl get podmonitor -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

6. Port-forward the Prometheus UI service.

   ```sh
   kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
   ```

7. Open the Prometheus UI [http://localhost:9090](http://localhost:9090) to query metrics.

8. Run a PromQL query to verify that agentgateway metrics are being scraped. In the Prometheus UI, enter the following query and click **Execute**.

   ```promql
   agentgateway_requests_total
   ```

   The result shows the total number of requests handled by agentgateway, broken down by gateway, listener, route, and status.

   {{< reuse-image src="img/prometheus-query.png" srcDark="img/prometheus-query-dark.png"  >}}

9. When you are done, remove the stack and the namespace.

   ```sh
   helm uninstall kube-prometheus-stack -n monitoring
   kubectl delete namespace monitoring
   ```

{{% /tab %}}
{{< /tabs >}}

## Other configurations

Review other common Prometheus configurations. 

### Docker Compose

To run agentgateway, Prometheus, and Grafana together as a single stack, use Docker Compose instead of individual containers.

```yaml
services:
  agentgateway:
    image: cr.agentgateway.dev/agentgateway:latest
    ports:
      - "3000:3000"
      - "15020:15020"
    volumes:
      - ./config.yaml:/config.yaml:ro
    command: ["-f", "/config.yaml"]

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  grafana-data:
```

## Learn more

{{< cards >}}
  {{< card path="/documentation/observability/metrics/grafana/" title="Grafana dashboard" subtitle="Visualize agentgateway metrics with the pre-built Grafana dashboard" >}}
  {{< card path="/documentation/observability/metrics/reference/" title="Metrics reference" subtitle="Full list of agentgateway metrics and labels" >}}
{{< /cards >}}
