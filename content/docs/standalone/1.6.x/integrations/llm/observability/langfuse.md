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
frontendPolicies:
  tracing:
    host: cloud.langfuse.com:443
    protocol: http
    path: /api/public/otel/v1/traces
    randomSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          Authorization: "Basic ${LANGFUSE_AUTH_HEADER}"

gateways:
  default:
    port: 3000
routes:
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

Set the credentials that the tracing policy sends in its `Authorization` header. The policy selects OTLP over HTTP, enables backend TLS, and uses the full trace ingestion path from the [Langfuse OpenTelemetry guide](https://langfuse.com/integrations/native/opentelemetry).

```bash
export LANGFUSE_AUTH_HEADER="$(printf '%s' '<your-public-key>:<your-secret-key>' | base64 | tr -d '\n')"
```

For a self-hosted instance, replace `host` with your Langfuse hostname and port, and keep the `/api/public/otel/v1/traces` path and authentication header. Remove `backendTLS` only if the destination serves plain HTTP.

## Docker Compose example

For **Langfuse Cloud**, agentgateway exports traces directly without needing an OTel Collector:

```yaml
version: '3'
services:
  agentgateway:
    image: {{< reuse "agw-docs/standalone/image-ref.md" >}}:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/config.yaml:ro
    command: ["-f", "/config.yaml"]
    environment:
      - LANGFUSE_AUTH_HEADER=${LANGFUSE_AUTH_HEADER}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

For self-hosted Langfuse, use your existing instance and ensure that the agentgateway container can reach its hostname.

## Learn more

- [Langfuse Documentation](https://langfuse.com/docs)
- [OpenTelemetry Integration]({{< link-hextra path="/documentation/observability/traces/setup/" >}})
