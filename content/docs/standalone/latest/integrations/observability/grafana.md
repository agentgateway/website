---
title: Grafana
weight: 30
description: Visualize agentgateway metrics and traces with Grafana
---

Use Grafana to create dashboards for agentgateway metrics and visualize distributed traces.

## Quick start

Run Grafana with Docker:

```bash
docker run -d --name grafana \
  -p 3001:3000 \
  grafana/grafana:latest
```

Access Grafana at [http://localhost:3001](http://localhost:3001) (default credentials: admin/admin).

## Add Prometheus data source

1. Go to **Configuration** → **Data Sources**
2. Click **Add data source**
3. Select **Prometheus**
4. Set URL to `http://prometheus:9090` (or your Prometheus URL)
5. Click **Save & Test**

## Add Jaeger data source

For distributed tracing:

1. Go to **Configuration** → **Data Sources**
2. Click **Add data source**
3. Select **Jaeger**
4. Set URL to `http://jaeger:16686` (or your Jaeger URL)
5. Click **Save & Test**

## Import the agentgateway dashboard

Instead of building panels by hand, import the pre-built agentgateway dashboard. This dashboard is maintained in the [agentgateway repository](https://github.com/agentgateway/agentgateway/blob/main/controller/install/helm/agentgateway/files/agentgateway-dashboard.json) and visualizes both the control and data plane metrics that agentgateway exposes.

1. Download the agentgateway Grafana dashboard.
   ```bash
   curl -L "https://raw.githubusercontent.com/agentgateway/agentgateway/main/controller/install/helm/agentgateway/files/agentgateway-dashboard.json" -o agentgateway-dashboard.json
   ```

2. In Grafana, go to **Dashboards** > **New** > **Import**.

3. Click **Upload dashboard JSON file** and select the `agentgateway-dashboard.json` file that you downloaded.

4. Select your Prometheus data source, then click **Import**.

5. Verify that you see metrics, such as the request rate by gateway, LLM token consumption, or MCP tool calls. The dashboard includes the following sections.

   {{< reuse "agw-docs/snippets/agentgateway/grafana-dashboard-metrics.md" >}}

## Build custom panels

If you prefer to build your own dashboard, you can create panels from the metrics that agentgateway exposes. The following examples show common queries.

### Request rate

```promql
rate(agentgateway_requests_total[5m])
```

### Request duration (p99)

```promql
histogram_quantile(0.99, rate(agentgateway_request_duration_seconds_bucket[5m]))
```

### Error rate

```promql
rate(agentgateway_requests_total{status=~"5.."}[5m]) / rate(agentgateway_requests_total[5m])
```

### LLM token usage

```promql
rate(agentgateway_llm_tokens_total[5m])
```

## Docker Compose example

```yaml
version: '3'
services:
  agentgateway:
    image: ghcr.io/agentgateway/agentgateway:latest
    ports:
      - "3000:3000"
      - "15020:15020"

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
      - grafana-storage:/var/lib/grafana

volumes:
  grafana-storage:
```

## Learn more

{{< cards >}}
  {{< card path="/integrations/observability/prometheus/" title="Prometheus" subtitle="Configure Prometheus metrics" >}}
  {{< card path="/integrations/observability/opentelemetry" title="OpenTelemetry" subtitle="Distributed tracing setup" >}}
{{< /cards >}}
