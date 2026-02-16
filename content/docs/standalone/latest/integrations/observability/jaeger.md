---
title: Jaeger
weight: 40
description: Distributed tracing with Jaeger for Agent Gateway
---

Jaeger is a distributed tracing backend that works with Agent Gateway's OpenTelemetry integration.

## Quick start

Run Jaeger with Docker:

```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  jaegertracing/all-in-one:latest
```

Configure Agent Gateway to send traces:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: true

binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
```

View traces at [http://localhost:16686](http://localhost:16686).

## Trace information

Agent Gateway traces include:

- **HTTP spans**: Request method, URL, status code, duration
- **MCP spans**: Session ID, method name, tool calls
- **LLM spans**: Model, token counts, provider
- **Backend spans**: Upstream connections and responses

## Docker Compose example

```yaml
version: '3'
services:
  agentgateway:
    image: ghcr.io/agentgateway/agentgateway:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/etc/agentgateway/config.yaml
    depends_on:
      - jaeger

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"
      - "4317:4317"
    environment:
      - COLLECTOR_OTLP_ENABLED=true
```

## Kubernetes deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jaeger
  template:
    metadata:
      labels:
        app: jaeger
    spec:
      containers:
      - name: jaeger
        image: jaegertracing/all-in-one:latest
        ports:
        - containerPort: 16686
        - containerPort: 4317
        env:
        - name: COLLECTOR_OTLP_ENABLED
          value: "true"
---
apiVersion: v1
kind: Service
metadata:
  name: jaeger
spec:
  selector:
    app: jaeger
  ports:
  - name: ui
    port: 16686
  - name: otlp
    port: 4317
```

## Learn more

{{< cards >}}
  {{< card link="../../observability/opentelemetry" title="OpenTelemetry" subtitle="Configure tracing in Agent Gateway" >}}
  {{< card link="../../../tutorials/telemetry" title="Telemetry Tutorial" subtitle="Step-by-step setup guide" >}}
{{< /cards >}}
