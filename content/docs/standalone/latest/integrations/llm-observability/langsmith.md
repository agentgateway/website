---
title: LangSmith
weight: 20
description: Integrate agentgateway with LangSmith for LLM debugging and monitoring
---

[LangSmith](https://smith.langchain.com/) is LangChain's platform for debugging, testing, evaluating, and monitoring LLM applications.

## Features

- **Trace logging** - Detailed request/response logging
- **Debugging** - Step-through debugging of LLM calls
- **Evaluation** - Automated testing and evaluation
- **Monitoring** - Production monitoring and alerting
- **Datasets** - Build and manage evaluation datasets

## Setup

1. Sign up at [smith.langchain.com](https://smith.langchain.com/)
2. Create a project and get your API key

## Configuration

LangSmith accepts OpenTelemetry traces directly. Configure agentgateway to export traces directly to LangSmith:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  tracing:
    otlpEndpoint: https://api.smith.langchain.com/otel
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

LangSmith requires an API key for authentication. Set the `OTEL_EXPORTER_OTLP_HEADERS` environment variable with your LangSmith API key:

```bash
# Set the x-api-key header for LangSmith authentication
export OTEL_EXPORTER_OTLP_HEADERS="x-api-key=your-langsmith-api-key"

# Also set the protocol to HTTP/protobuf (LangSmith requires HTTP, not gRPC)
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

## Docker Compose example

Agentgateway exports traces directly to LangSmith without needing an OTel Collector:

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
      - OTEL_EXPORTER_OTLP_HEADERS=x-api-key=${LANGSMITH_API_KEY}
      - OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

## Learn more

- [LangSmith Documentation](https://docs.langchain.com/langsmith)
- [OpenTelemetry Integration]({{< link-hextra path="/integrations/observability/opentelemetry" >}})
