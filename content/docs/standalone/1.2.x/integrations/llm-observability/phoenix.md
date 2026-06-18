---
title: Arize Phoenix
weight: 30
description: Integrate agentgateway with Arize Phoenix for LLM tracing and evaluation
---

[Arize Phoenix](https://arize.com/phoenix/) is an open-source LLM observability platform for tracing, evaluation, and debugging.

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

Phoenix accepts OpenTelemetry traces natively on port 4317 (gRPC) and port 6006 (HTTP), so agentgateway can export traces directly to Phoenix without an intermediate OpenTelemetry Collector.

Configure agentgateway to send traces directly to Phoenix:

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

Agentgateway exports traces directly to Phoenix without needing an OTel Collector:

```yaml
version: '3'
services:
  agentgateway:
    image: ghcr.io/agentgateway/agentgateway:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/etc/agentgateway/config.yaml

  phoenix:
    image: arizephoenix/phoenix:latest
    ports:
      - "6006:6006"
      - "4317:4317"
```

When using Docker Compose, update your config.yaml to use the Phoenix service name:

```yaml
config:
  tracing:
    otlpEndpoint: http://phoenix:4317
    randomSampling: true
```

## Learn more

- [Phoenix Documentation](https://arize.com/docs/phoenix)
- [OpenTelemetry Integration]({{< link-hextra path="/integrations/observability/opentelemetry" >}})
