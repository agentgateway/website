---
title: Grafana
weight: 30
description: Visualize Agent Gateway metrics and traces with Grafana
---

Use Grafana to create dashboards for Agent Gateway metrics and visualize distributed traces.

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

## Sample dashboard

Create a dashboard with these panels:

### Request rate

```promql
rate(agentgateway_requests_total[5m])
```

### Request duration (p99)

```promql
histogram_quantile(0.99, rate(agentgateway_request_duration_seconds_bucket[5m]))
```

### Active connections

```promql
agentgateway_connections_active
```

### Error rate

```promql
rate(agentgateway_requests_total{status=~"5.."}[5m]) / rate(agentgateway_requests_total[5m])
```

### LLM token usage

```promql
rate(agentgateway_llm_tokens_total[5m])
```

### MCP sessions

```promql
agentgateway_mcp_sessions_active
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
  {{< card link="prometheus" title="Prometheus" subtitle="Configure Prometheus metrics" >}}
  {{< card link="opentelemetry" title="OpenTelemetry" subtitle="Distributed tracing setup" >}}
{{< /cards >}}
