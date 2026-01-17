---
title: Open WebUI
description: Secure and observe Open WebUI with Agent Gateway for enterprise LLM governance
---

[Open WebUI](https://github.com/open-webui/open-webui) is a self-hosted, feature-rich web interface for interacting with LLMs. It supports multiple model providers, conversation history, RAG pipelines, and tool integrations.

## What is Open WebUI?

Open WebUI provides a ChatGPT-like experience that you can run on your own infrastructure. Key features include:

- Multi-model support (OpenAI, Ollama, and OpenAI-compatible APIs)
- Conversation management and history
- Document upload and RAG capabilities
- Custom tool and function calling
- User management and authentication
- Markdown and code rendering

## Why Use Agent Gateway with Open WebUI?

While Open WebUI provides a great user experience, enterprises need additional controls for production deployments:

| Challenge | Agent Gateway Solution |
|-----------|----------------------|
| No centralized audit trail | Complete logging of all LLM requests and responses |
| Direct API key exposure | Proxy authentication - no keys in Open WebUI config |
| No rate limiting per user | Per-user and per-model rate limits |
| Limited access control | RBAC policies for models and capabilities |
| No cost tracking | Token usage metrics and cost attribution |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Open WebUI    │────▶│  Agent Gateway  │────▶│   LLM Provider  │
│                 │     │                 │     │  (OpenAI, etc)  │
└─────────────────┘     │  - Auth         │     └─────────────────┘
                        │  - Audit        │
                        │  - Rate Limit   │     ┌─────────────────┐
                        │  - Metrics      │────▶│   MCP Servers   │
                        └─────────────────┘     └─────────────────┘
```

## Configuration

### 1. Configure Agent Gateway

Set up Agent Gateway with your LLM providers:

```yaml
listeners:
  - name: llm-gateway
    address: 0.0.0.0
    port: 8080
    protocol: HTTP

llm:
  providers:
    - name: openai
      type: openai
      api_key: ${OPENAI_API_KEY}
```

### 2. Configure Open WebUI

Point Open WebUI to Agent Gateway instead of directly to OpenAI:

```bash
docker run -d \
  -p 3000:8080 \
  -e OPENAI_API_BASE_URL=http://agentgateway:8080/v1 \
  -e OPENAI_API_KEY=your-gateway-api-key \
  ghcr.io/open-webui/open-webui:main
```

Or use Docker Compose for a complete setup:

```yaml
version: '3.8'
services:
  agentgateway:
    image: ghcr.io/agentgateway/agentgateway:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config.yaml:/etc/agentgateway/config.yaml
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}

  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "3000:8080"
    environment:
      - OPENAI_API_BASE_URL=http://agentgateway:8080/v1
      - OPENAI_API_KEY=${GATEWAY_API_KEY}
    depends_on:
      - agentgateway
```

### 3. Add Authentication Policy

Require authentication for all requests:

```yaml
security:
  authentication:
    type: jwt
    jwks_uri: https://your-idp/.well-known/jwks.json
```

### 4. Enable Audit Logging

Capture all LLM interactions:

```yaml
observability:
  logging:
    enabled: true
    level: info
    include_request_body: true
    include_response_body: true
```

## Governance Capabilities

### Audit Trail

Every conversation through Open WebUI is logged with:
- User identity
- Timestamp
- Model used
- Full prompt and response
- Token counts
- Latency metrics

### Access Control

Restrict which models users can access:

```yaml
authorization:
  policies:
    - name: allow-gpt4-for-admins
      principals: ["role:admin"]
      resources: ["model:gpt-4*"]
      action: allow
    - name: allow-gpt35-for-users
      principals: ["role:user"]
      resources: ["model:gpt-3.5*"]
      action: allow
```

### Rate Limiting

Prevent cost overruns:

```yaml
rate_limiting:
  - name: per-user-limit
    match:
      headers:
        x-user-id: "*"
    limit: 100
    window: 1h
```

## MCP Tool Governance

If Open WebUI uses MCP tools, Agent Gateway provides:

- **Tool Authorization** - Control which tools users can invoke
- **Parameter Validation** - Ensure tool inputs meet security requirements
- **Execution Logging** - Full audit of tool calls and results

## Observability

Monitor Open WebUI usage with built-in metrics:

- Request volume by user and model
- Token consumption trends
- Error rates and latency percentiles
- Cost attribution dashboards

See [Observability](/docs/integrations/observability/) for Prometheus and Grafana integration.
