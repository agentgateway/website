---
title: LibreChat
description: Secure and observe LibreChat with Agent Gateway for enterprise LLM governance
---

[LibreChat](https://github.com/danny-avila/LibreChat) is an open-source, multi-model chat interface that supports OpenAI, Anthropic, Google, and many other LLM providers. It offers a modern UI with features like conversation branching, presets, and plugins.

## What is LibreChat?

LibreChat provides a unified interface for multiple LLM providers:

- **Multi-Provider Support** - OpenAI, Anthropic, Google, Azure, and more
- **Conversation Management** - Branching, editing, and regeneration
- **Presets & Templates** - Save and share conversation configurations
- **Plugin System** - Extend functionality with custom plugins
- **User Management** - Multi-user support with authentication
- **File Uploads** - Image and document analysis

## Why Use Agent Gateway with LibreChat?

LibreChat connects to multiple providers, creating governance challenges:

| Challenge | Agent Gateway Solution |
|-----------|----------------------|
| Multiple API keys to manage | Single gateway, centralized credentials |
| Inconsistent logging across providers | Unified audit trail |
| No cross-provider rate limiting | Global and per-provider limits |
| Provider-specific auth | Standardized authentication |
| Fragmented cost tracking | Consolidated token metrics |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   LibreChat     │────▶│  Agent Gateway  │────▶│     OpenAI      │
│                 │     │                 │     └─────────────────┘
│  - OpenAI       │     │  - Unified Auth │     ┌─────────────────┐
│  - Anthropic    │     │  - Audit Log    │────▶│   Anthropic     │
│  - Google       │     │  - Rate Limits  │     └─────────────────┘
│  - Plugins      │     │  - Metrics      │     ┌─────────────────┐
└─────────────────┘     └─────────────────┘────▶│     Google      │
                                                └─────────────────┘
```

## Configuration

### 1. Configure Agent Gateway

Set up multiple LLM providers:

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

    - name: anthropic
      type: anthropic
      api_key: ${ANTHROPIC_API_KEY}

    - name: google
      type: gemini
      api_key: ${GOOGLE_API_KEY}
```

### 2. Configure LibreChat

Update LibreChat's `.env` to route through Agent Gateway:

```bash
# Point all providers to Agent Gateway
OPENAI_API_BASE=http://agentgateway:8080/v1
ANTHROPIC_API_BASE=http://agentgateway:8080/anthropic
GOOGLE_API_BASE=http://agentgateway:8080/google

# Use gateway-issued keys or pass-through
OPENAI_API_KEY=your-gateway-key
ANTHROPIC_API_KEY=your-gateway-key
GOOGLE_API_KEY=your-gateway-key
```

Or in `librechat.yaml` using custom endpoints:

```yaml
version: 1.2.8
endpoints:
  custom:
    - name: "OpenAI via Gateway"
      apiKey: "${GATEWAY_API_KEY}"
      baseURL: "http://agentgateway:8080/v1"
      models:
        default: ["gpt-4", "gpt-3.5-turbo"]
        fetch: true
      titleConvo: true
      titleModel: "gpt-3.5-turbo"

    - name: "Anthropic via Gateway"
      apiKey: "${GATEWAY_API_KEY}"
      baseURL: "http://agentgateway:8080/anthropic"
      models:
        default: ["claude-3-opus", "claude-3-sonnet"]
        fetch: true
```

### 3. Enable Authentication

Require JWT authentication:

```yaml
security:
  authentication:
    type: jwt
    jwks_uri: https://your-idp/.well-known/jwks.json
    claims_mapping:
      user_id: sub
      email: email
      roles: groups
```

## Governance Capabilities

### Unified Audit Trail

All provider interactions logged consistently:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "user": "user@example.com",
  "provider": "anthropic",
  "model": "claude-3-opus",
  "prompt_tokens": 500,
  "completion_tokens": 1200,
  "request_id": "req_abc123",
  "conversation_id": "conv_xyz789"
}
```

### Cross-Provider Rate Limiting

Set global and per-provider limits:

```yaml
rate_limiting:
  # Global limit across all providers
  - name: global-user-limit
    match:
      headers:
        x-user-id: "*"
    limit: 1000
    window: 1h

  # Provider-specific limits
  - name: openai-limit
    match:
      path_prefix: /v1
    limit: 500
    window: 1h

  - name: anthropic-limit
    match:
      path_prefix: /anthropic
    limit: 300
    window: 1h
```

### Model Access Control

Control which models users can access:

```yaml
authorization:
  policies:
    # Premium users get access to all models
    - name: premium-users
      principals: ["role:premium"]
      resources:
        - "model:gpt-4*"
        - "model:claude-3-opus*"
        - "model:gemini-ultra*"
      action: allow

    # Standard users limited to smaller models
    - name: standard-users
      principals: ["role:standard"]
      resources:
        - "model:gpt-3.5*"
        - "model:claude-3-haiku*"
        - "model:gemini-pro*"
      action: allow
```

### Content Filtering

Apply consistent content policies:

```yaml
content_filtering:
  rules:
    - name: pii-protection
      patterns:
        - "\\b\\d{3}-\\d{2}-\\d{4}\\b"  # SSN
        - "\\b\\d{16}\\b"                # Credit card
      action: redact

    - name: block-sensitive-topics
      keywords:
        - "confidential"
        - "internal only"
      action: block
```

## Plugin Governance

If LibreChat plugins make external calls:

```yaml
plugins:
  authorization:
    - name: allow-search-plugin
      plugin: web-search
      users: ["*"]
      action: allow

    - name: restrict-code-execution
      plugin: code-interpreter
      users: ["role:developer"]
      action: allow
```

## Observability

### Multi-Provider Metrics

Track usage across all providers:

```promql
# Requests by provider
sum(rate(agentgateway_llm_requests_total[5m])) by (provider)

# Token usage comparison
sum(agentgateway_llm_tokens_total) by (provider, model)

# Cost per provider (with configured pricing)
sum(agentgateway_llm_cost_dollars) by (provider)
```

### Cost Attribution

Attribute costs to users and teams:

```yaml
observability:
  metrics:
    labels:
      - user_id
      - team
      - provider
      - model
    cost_tracking:
      enabled: true
      pricing:
        openai:
          gpt-4: { input: 0.03, output: 0.06 }
          gpt-3.5-turbo: { input: 0.001, output: 0.002 }
        anthropic:
          claude-3-opus: { input: 0.015, output: 0.075 }
```

## Docker Compose Example

Complete setup with LibreChat and Agent Gateway:

```yaml
version: '3.8'
services:
  agentgateway:
    image: ghcr.io/agentgateway/agentgateway:latest
    ports:
      - "8080:8080"
    volumes:
      - ./gateway-config.yaml:/etc/agentgateway/config.yaml
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

  librechat:
    image: ghcr.io/danny-avila/librechat:latest
    ports:
      - "3000:3080"
    environment:
      - OPENAI_API_BASE=http://agentgateway:8080/v1
      - ANTHROPIC_API_BASE=http://agentgateway:8080/anthropic
    depends_on:
      - agentgateway
      - mongodb

  mongodb:
    image: mongo:latest
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

## Best Practices

1. **Centralize Credentials** - Store API keys in Agent Gateway, not LibreChat
2. **Enable All Providers** - Configure all providers in gateway for flexibility
3. **Set User Quotas** - Implement per-user token budgets
4. **Log Conversations** - Enable audit logging for compliance
5. **Use Cost Tracking** - Monitor spending across providers
