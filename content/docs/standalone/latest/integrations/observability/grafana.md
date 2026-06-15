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

## Agentgateway dashboard

Import the pre-built Agentgateway Grafana dashboard JSON (maintained with the Agentgateway Helm chart):

1. Download `agentgateway.json` from [/docs/kubernetes/latest/observability/agentgateway.json](/docs/kubernetes/latest/observability/agentgateway.json)
2. In Grafana, go to **Dashboards** → **New** → **Import**
3. Upload the JSON file (or paste its contents), select your **Prometheus** data source when prompted, and click **Import**

If you're following the `main` docs, download the dashboard from [/docs/kubernetes/main/observability/agentgateway.json](/docs/kubernetes/main/observability/agentgateway.json) instead.

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
