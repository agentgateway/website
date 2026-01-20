---
title: LangSmith
weight: 20
description: Integrate Agent Gateway with LangSmith for LLM debugging and monitoring
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
3. Configure the OpenTelemetry Collector to forward traces

## Configuration

LangSmith accepts OpenTelemetry traces via their OTLP endpoint:

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

exporters:
  otlphttp:
    endpoint: https://api.smith.langchain.com/otel
    headers:
      x-api-key: "${LANGSMITH_API_KEY}"

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

## Learn more

- [LangSmith Documentation](https://docs.smith.langchain.com/)
- [OpenTelemetry Integration](/docs/integrations/observability/opentelemetry)
