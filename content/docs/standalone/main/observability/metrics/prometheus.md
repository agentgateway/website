---
title: Prometheus
weight: 30
description: Scrape agentgateway metrics with Prometheus.
---

[Prometheus](https://prometheus.io/) is an open-source monitoring system that scrapes and stores time-series metrics. It is the standard way to collect and query agentgateway metrics, and is the data source behind the [Grafana dashboard]({{< link-hextra path="/observability/metrics/grafana/" >}}). Prometheus is well-suited for agentgateway because it handles high-cardinality label sets — such as per-route, per-model, and per-provider breakdowns — efficiently, and its query language (PromQL) makes it easy to build alerts and dashboards from those labels.

Agentgateway is built to work with Prometheus out of the box:

- It exposes a `/metrics` endpoint on port `15020` in the [OpenMetrics](https://openmetrics.io/) format, which Prometheus can scrape directly.
- All metrics use the `agentgateway_` prefix and carry consistent route identifier labels so you can filter and aggregate by gateway, listener, and route without additional configuration.
- On Kubernetes, agentgateway pods are automatically annotated with `prometheus.io/scrape: "true"` and `prometheus.io/port: "15020"`, so Prometheus picks them up without any manual scrape config.

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

   {{< reuse-image src="img/main/prometheus-query.png" srcDark="img/main/prometheus-query-dark.png"  >}}

5. When you are done, remove the Prometheus container.

   ```sh
   docker rm -f prometheus
   ```

{{% /tab %}}
{{% tab name="Kubernetes (Helm)" %}}

The recommended way to run Prometheus on Kubernetes is with the `kube-prometheus-stack` Helm chart, which installs Prometheus, Alertmanager, and Grafana together and automatically scrapes pods based on annotations.

Agentgateway pods are automatically annotated with `prometheus.io/scrape: "true"` and `prometheus.io/port: "15020"`, so no additional scrape configuration is needed. 

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

4. Port-forward the Prometheus UI service.

   ```sh
   kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
   ```

5. Open the Prometheus UI [http://localhost:9090](http://localhost:9090) to query metrics.

6. Run a PromQL query to verify that agentgateway metrics are being scraped. In the Prometheus UI, enter the following query and click **Execute**.

   ```promql
   agentgateway_requests_total
   ```

   The result shows the total number of requests handled by agentgateway, broken down by gateway, listener, route, and status.

   {{< reuse-image src="img/main/prometheus-query.png" srcDark="img/main/prometheus-query-dark.png"  >}}

6. When you are done, remove the stack and the namespace.

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
  {{< card path="/observability/metrics/grafana/" title="Grafana dashboard" subtitle="Visualize agentgateway metrics with the pre-built Grafana dashboard" >}}
  {{< card path="/observability/metrics/reference/" title="Metrics reference" subtitle="Full list of agentgateway metrics and labels" >}}
{{< /cards >}}
