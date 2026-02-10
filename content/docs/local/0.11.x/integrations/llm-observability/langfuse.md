---
title: Langfuse
weight: 10
description: Integrate Agent Gateway with Langfuse for LLM analytics and prompt management
---

[Langfuse](https://langfuse.com/) is an open-source LLM observability platform that provides prompt management, analytics, and evaluation.

## Features

- **Prompt tracing** - Log all prompts and responses
- **Cost tracking** - Monitor token usage and costs
- **Latency analytics** - Track response times
- **Prompt management** - Version and deploy prompts
- **Evaluation** - Score and evaluate outputs
- **User tracking** - Attribute usage to users

## Setup

### Self-hosted Langfuse

Run Langfuse locally with Docker:

```bash
git clone https://github.com/langfuse/langfuse.git
cd langfuse
docker compose up -d
```

Access Langfuse at [http://localhost:3000](http://localhost:3000).

### Cloud Langfuse

Sign up at [langfuse.com](https://langfuse.com/) and get your API keys.

## Configuration

Langfuse accepts OpenTelemetry traces. Configure an OTEL Collector to forward traces:

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

exporters:
  otlphttp:
    endpoint: https://cloud.langfuse.com/api/public/otel
    headers:
      Authorization: "Basic <base64-encoded-public-key:secret-key>"

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlphttp]
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
    depends_on:
      - otel-collector

  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    ports:
      - "4317:4317"
    volumes:
      - ./otel-collector-config.yaml:/etc/otel/config.yaml
    command: ["--config", "/etc/otel/config.yaml"]

  langfuse:
    image: langfuse/langfuse:latest
    ports:
      - "3001:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/langfuse
      - NEXTAUTH_SECRET=your-secret
      - NEXTAUTH_URL=http://localhost:3001
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=langfuse
    volumes:
      - langfuse-db:/var/lib/postgresql/data

volumes:
  langfuse-db:
```

## Learn more

- [Langfuse Documentation](https://langfuse.com/docs)
- [OpenTelemetry Integration]({{< link-hextra path="/integrations/observability/opentelemetry" >}})
