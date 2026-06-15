---
title: Langfuse
weight: 10
description: Integrate agentgateway with Langfuse for LLM analytics and prompt management
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

Langfuse accepts OpenTelemetry traces directly. Configure agentgateway to export traces directly to your Langfuse deployment:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  tracing:
    otlpEndpoint: https://cloud.langfuse.com/api/public/otel
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

### Authentication

Langfuse Cloud requires Basic Authentication for direct OTLP export. To authenticate, set the `OTEL_EXPORTER_OTLP_HEADERS` environment variable with your Langfuse API credentials:

```bash
# Base64-encode your Langfuse public key and secret key
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic $(echo -n 'your-public-key:your-secret-key' | base64)"

# Also set the protocol to HTTP/protobuf (Langfuse Cloud requires HTTP, not gRPC)
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

If you're using a self-hosted Langfuse instance that doesn't require authentication, you can omit the `OTEL_EXPORTER_OTLP_HEADERS` variable and point directly to your instance:

```yaml
# For self-hosted Langfuse
config:
  tracing:
    otlpEndpoint: http://localhost:4317  # or your self-hosted instance URL
    randomSampling: true
```

## Docker Compose example

For **Langfuse Cloud**, agentgateway exports traces directly without needing an OTel Collector:

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
      - OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic ${LANGFUSE_AUTH_HEADER}
      - OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

For **self-hosted Langfuse**, you can point agentgateway directly to your instance:

```yaml
version: '3'
services:
  agentgateway:
    image: ghcr.io/agentgateway/agentgateway:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/etc/agentgateway/config.yaml

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
