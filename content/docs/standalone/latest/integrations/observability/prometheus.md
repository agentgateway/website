---
title: Prometheus
weight: 20
description: Collect metrics from agentgateway with Prometheus
---

Agentgateway exposes Prometheus-compatible metrics for monitoring and alerting.

## Metrics endpoint

Agentgateway exposes metrics on port `15020` by default:

```bash
curl http://localhost:15020/metrics
```

## Available metrics

### Request metrics

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_requests_total` | Counter | Total number of requests |
| `agentgateway_request_duration_seconds` | Histogram | Request duration |
| `agentgateway_request_size_bytes` | Histogram | Request size |
| `agentgateway_response_size_bytes` | Histogram | Response size |

### Connection metrics

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_connections_active` | Gauge | Active connections |
| `agentgateway_connections_total` | Counter | Total connections |

### MCP metrics

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_mcp_sessions_active` | Gauge | Active MCP sessions |
| `agentgateway_mcp_requests_total` | Counter | Total MCP requests by method |

### LLM metrics

| Metric | Type | Description |
|--------|------|-------------|
| `agentgateway_llm_requests_total` | Counter | Total LLM requests |
| `agentgateway_llm_tokens_total` | Counter | Total tokens (input/output) |
| `agentgateway_llm_request_duration_seconds` | Histogram | LLM request duration |

## Prometheus configuration

Add agentgateway to your Prometheus configuration:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'agentgateway'
    static_configs:
      - targets: ['localhost:15020']
    scrape_interval: 15s
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
    volumes:
      - ./config.yaml:/etc/agentgateway/config.yaml

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
```

## Kubernetes ServiceMonitor

For Kubernetes deployments with Prometheus Operator:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: agentgateway
spec:
  selector:
    matchLabels:
      app: agentgateway
  endpoints:
  - port: metrics
    interval: 15s
    path: /metrics
```

## Learn more

{{< cards >}}
  {{< card link="../../observability/grafana" title="Grafana" subtitle="Visualize metrics with Grafana" >}}
  {{< card link="../../../tutorials/telemetry" title="Telemetry Tutorial" subtitle="Step-by-step observability setup" >}}
{{< /cards >}}
