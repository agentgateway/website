---
title: Arize Phoenix
weight: 30
description: Integrate Agent Gateway with Arize Phoenix for LLM tracing and evaluation
---

[Arize Phoenix](https://phoenix.arize.com/) is an open-source LLM observability platform for tracing, evaluation, and debugging.

## Features

- **LLM tracing** - Trace all LLM calls with full context
- **Evaluation** - Built-in LLM evaluators for quality assessment
- **Embedding analysis** - Visualize and debug embeddings
- **Dataset management** - Create and manage evaluation datasets
- **Open source** - Self-host or use Arize cloud

## Quick start

Run Phoenix locally:

```bash
pip install arize-phoenix
phoenix serve
```

Or with Docker:

```bash
docker run -p 6006:6006 arizephoenix/phoenix:latest
```

Access Phoenix at [http://localhost:6006](http://localhost:6006).

## Configuration

Phoenix accepts OpenTelemetry traces natively:

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

exporters:
  otlp:
    endpoint: http://localhost:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlp]
```

Configure Agent Gateway:

```yaml
config:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: true

binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI:
              model: gpt-4o-mini
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
```

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
    environment:
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://phoenix:4317

  phoenix:
    image: arizephoenix/phoenix:latest
    ports:
      - "6006:6006"
      - "4317:4317"
```

## Learn more

- [Phoenix Documentation](https://docs.arize.com/phoenix)
- [OpenTelemetry Integration]({{< link-hextra path="/integrations/observability/opentelemetry" >}})
