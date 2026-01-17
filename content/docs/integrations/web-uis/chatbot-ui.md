---
title: Chatbot UI
description: Secure and observe Chatbot UI with Agent Gateway for enterprise LLM governance
---

[Chatbot UI](https://github.com/mckaywrigley/chatbot-ui) is an open-source ChatGPT interface created by Mckay Wrigley. It provides a clean, modern UI for interacting with OpenAI and other LLM providers.

## What is Chatbot UI?

Chatbot UI offers a streamlined chat experience:

- **Clean Interface** - Minimal, ChatGPT-inspired design
- **Conversation Management** - Organize chats in folders
- **Prompt Templates** - Save and reuse system prompts
- **Model Selection** - Switch between available models
- **Export/Import** - Backup and restore conversations
- **Local Storage** - Conversations stored in browser (Supabase option available)

## Why Use Agent Gateway with Chatbot UI?

Chatbot UI is designed for simplicity, but enterprises need additional controls:

| Challenge | Agent Gateway Solution |
|-----------|----------------------|
| Direct API key exposure | Proxy authentication |
| No server-side logging | Complete audit trail |
| No usage limits | Rate limiting and quotas |
| Single-user focus | Multi-user governance |
| No access control | Role-based model access |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Chatbot UI    │────▶│  Agent Gateway  │────▶│   LLM Provider  │
│   (Browser)     │     │                 │     │  (OpenAI, etc)  │
└─────────────────┘     │  - Auth         │     └─────────────────┘
                        │  - Audit        │
                        │  - Rate Limit   │
                        │  - Metrics      │
                        └─────────────────┘
```

## Configuration

### 1. Configure Agent Gateway

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

security:
  authentication:
    type: api_key
    header: Authorization
    keys:
      - name: chatbot-ui-key
        key: ${CHATBOT_UI_API_KEY}
        metadata:
          app: chatbot-ui
```

### 2. Configure Chatbot UI

Set the OpenAI API endpoint to Agent Gateway:

```bash
# Environment variables
OPENAI_API_HOST=http://agentgateway:8080
OPENAI_API_KEY=your-gateway-api-key
```

Or in the UI settings, set:
- **API Host**: `http://your-gateway-host:8080`
- **API Key**: Your gateway-issued key

### 3. Self-Hosted Deployment

Deploy with Docker Compose:

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

  chatbot-ui:
    image: ghcr.io/mckaywrigley/chatbot-ui:main
    ports:
      - "3000:3000"
    environment:
      - OPENAI_API_HOST=http://agentgateway:8080
      - OPENAI_API_KEY=${GATEWAY_API_KEY}
    depends_on:
      - agentgateway
```

## Governance Capabilities

### API Key Management

Issue scoped API keys for different users:

```yaml
security:
  authentication:
    type: api_key
    keys:
      - name: user-alice
        key: ${ALICE_KEY}
        metadata:
          user: alice
          team: engineering
        rate_limit: 100/hour

      - name: user-bob
        key: ${BOB_KEY}
        metadata:
          user: bob
          team: marketing
        rate_limit: 50/hour
```

### Model Restrictions

Limit available models per API key:

```yaml
authorization:
  policies:
    - name: engineering-models
      match:
        metadata:
          team: engineering
      resources:
        - "model:gpt-4*"
        - "model:gpt-3.5*"
      action: allow

    - name: marketing-models
      match:
        metadata:
          team: marketing
      resources:
        - "model:gpt-3.5*"
      action: allow
```

### Audit Logging

Track all conversations:

```yaml
observability:
  logging:
    enabled: true
    include_request_body: true
    include_response_body: true
    redact_patterns:
      - "(?i)password"
      - "(?i)secret"
```

Example audit log entry:

```json
{
  "timestamp": "2024-01-15T14:30:00Z",
  "api_key_name": "user-alice",
  "user": "alice",
  "team": "engineering",
  "model": "gpt-4",
  "prompt_tokens": 150,
  "completion_tokens": 300,
  "latency_ms": 1200,
  "status": "success"
}
```

### Rate Limiting

Prevent abuse and control costs:

```yaml
rate_limiting:
  - name: per-key-requests
    match:
      header: Authorization
    limit: 100
    window: 1h
    limit_by: requests

  - name: per-key-tokens
    match:
      header: Authorization
    limit: 50000
    window: 1h
    limit_by: tokens
```

### Content Filtering

Apply safety rules:

```yaml
content_filtering:
  input:
    - name: block-jailbreaks
      patterns:
        - "ignore previous instructions"
        - "pretend you are"
      action: block

  output:
    - name: redact-pii
      patterns:
        - "\\b\\d{3}-\\d{2}-\\d{4}\\b"
      action: redact
```

## Observability

### Usage Metrics

Monitor Chatbot UI usage:

```promql
# Requests per user
sum(rate(agentgateway_llm_requests_total{app="chatbot-ui"}[5m])) by (user)

# Token consumption by team
sum(agentgateway_llm_tokens_total{app="chatbot-ui"}) by (team)

# Average latency
histogram_quantile(0.95, rate(agentgateway_llm_latency_seconds_bucket[5m]))
```

### Grafana Dashboard

Create dashboards showing:
- Active users over time
- Model usage distribution
- Token consumption trends
- Error rates by user

## Supabase Integration

The current version of Chatbot UI requires Supabase for data persistence. When using Supabase, Agent Gateway can validate Supabase JWTs for additional security:

```yaml
# Agent Gateway can validate Supabase JWTs
security:
  authentication:
    type: jwt
    jwks_uri: https://your-project.supabase.co/auth/v1/jwks
    audience: authenticated
```

For a complete deployment with Supabase, see the [Chatbot UI documentation](https://github.com/mckaywrigley/chatbot-ui#readme) for database setup instructions.

## Best Practices

1. **Issue Per-User Keys** - Track usage by individual
2. **Set Conservative Limits** - Start low, increase as needed
3. **Enable Audit Logging** - Required for enterprise compliance
4. **Use Content Filtering** - Protect against prompt injection
5. **Monitor Costs** - Set up alerts for unusual usage
6. **Regular Key Rotation** - Rotate API keys periodically
