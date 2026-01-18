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

## Tutorial: Multi-LLM Platform with SSO and Observability

This tutorial walks through deploying a complete enterprise platform that unifies multiple AI providers (Anthropic, OpenAI, xAI, Gemini) through Agent Gateway with Keycloak SSO and full observability.

{{< callout type="info" >}}
A complete reference implementation is available at [agentgateway-webui-multi-llm-docker](https://github.com/aiagentplayground/agentgateway-webui-multi-llm-docker).
{{< /callout >}}

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Open WebUI    │────▶│  Agent Gateway  │────▶│   Anthropic     │
│   (Port 8888)   │     │   (Port 3000)   │     │   (Claude)      │
└─────────────────┘     │                 │     └─────────────────┘
        │               │  Unified API    │     ┌─────────────────┐
        │               │  Rate Limiting  │────▶│     OpenAI      │
        ▼               │  Tracing        │     │   (GPT models)  │
┌─────────────────┐     │  Metrics        │     └─────────────────┘
│    Keycloak     │     │                 │     ┌─────────────────┐
│   (Port 8090)   │     └─────────────────┘────▶│      xAI        │
│      SSO        │              │              │   (Grok)        │
└─────────────────┘              │              └─────────────────┘
                                 │              ┌─────────────────┐
┌─────────────────┐              └─────────────▶│  Google Gemini  │
│   Observability │                             └─────────────────┘
│  Prometheus     │
│  Grafana        │
│  Jaeger         │
└─────────────────┘
```

### Services and Ports

| Service | Port | Purpose |
|---------|------|---------|
| Open WebUI | 8888 | Chat interface |
| Agent Gateway | 3000 | Unified LLM API endpoint |
| Agent Gateway UI | 15000 | Admin interface |
| Keycloak | 8090 | SSO authentication |
| Grafana | 3100 | Metrics dashboards |
| Prometheus | 9090 | Metrics collection |
| Jaeger | 16686 | Distributed tracing |

### Step 1: Set Up Environment Variables

Create a `.env` file with your API keys:

```bash
# LLM Provider API Keys
OPENAI_API_KEY=sk-...        # https://platform.openai.com/api-keys
ANTHROPIC_API_KEY=sk-ant-... # https://console.anthropic.com/settings/keys
XAI_API_KEY=xai-...          # https://console.x.ai
GEMINI_API_KEY=...           # https://aistudio.google.com/app/apikey

# Database passwords (change for production)
KEYCLOAK_DB_PASSWORD=keycloak_password
POSTGRES_PASSWORD=postgres_password
```

### Step 2: Configure Agent Gateway

Create `agentgateway.yaml` with a unified gateway that routes to all providers:

```yaml
listeners:
  # Unified gateway - single endpoint for all providers
  - name: unified-gateway
    address: 0.0.0.0
    port: 3000
    protocol: HTTP
    routes:
      - path_prefix: /v1
        target: openai
      - path_prefix: /anthropic
        target: anthropic
      - path_prefix: /xai
        target: xai
      - path_prefix: /gemini
        target: gemini

llm:
  providers:
    - name: anthropic
      type: anthropic
      api_key: ${ANTHROPIC_API_KEY}
      models:
        - claude-haiku-4-5-20251001

    - name: openai
      type: openai
      api_key: ${OPENAI_API_KEY}
      models:
        - gpt-4o
        - gpt-4o-mini

    - name: xai
      type: openai  # xAI uses OpenAI-compatible API
      api_key: ${XAI_API_KEY}
      base_url: https://api.x.ai/v1
      models:
        - grok-4-latest

    - name: gemini
      type: gemini
      api_key: ${GEMINI_API_KEY}
      models:
        - gemini-2.0-flash

rate_limiting:
  - name: global-rate-limit
    limit: 100
    window: 1m
    limit_by: requests

observability:
  tracing:
    enabled: true
    exporter: otlp
    endpoint: jaeger:4317
  metrics:
    enabled: true
    port: 15020
```

### Step 3: Deploy with Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  agentgateway:
    image: ghcr.io/agentgateway/agentgateway:latest
    ports:
      - "3000:3000"    # Unified API
      - "15000:15000"  # Admin UI
      - "15020:15020"  # Metrics
    volumes:
      - ./agentgateway.yaml:/etc/agentgateway/config.yaml
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - XAI_API_KEY=${XAI_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      - jaeger
    restart: unless-stopped

  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "8888:8080"
    environment:
      - OPENAI_API_BASE_URL=http://agentgateway:3000/v1
      - OPENAI_API_KEY=not-needed  # Gateway handles auth
      - OAUTH_CLIENT_ID=open-webui
      - OAUTH_CLIENT_SECRET=open-webui-secret
      - OPENID_PROVIDER_URL=http://keycloak:8080/realms/agentgateway
      - ENABLE_OAUTH_SIGNUP=true
    depends_on:
      - agentgateway
      - keycloak
    restart: unless-stopped

  keycloak:
    image: quay.io/keycloak/keycloak:latest
    command: start-dev
    ports:
      - "8090:8080"
    environment:
      - KEYCLOAK_ADMIN=admin
      - KEYCLOAK_ADMIN_PASSWORD=admin
      - KC_DB=postgres
      - KC_DB_URL=jdbc:postgresql://keycloak-db:5432/keycloak
      - KC_DB_USERNAME=keycloak
      - KC_DB_PASSWORD=${KEYCLOAK_DB_PASSWORD}
    depends_on:
      - keycloak-db
    restart: unless-stopped

  keycloak-db:
    image: postgres:15
    environment:
      - POSTGRES_DB=keycloak
      - POSTGRES_USER=keycloak
      - POSTGRES_PASSWORD=${KEYCLOAK_DB_PASSWORD}
    volumes:
      - keycloak_data:/var/lib/postgresql/data
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3100:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    restart: unless-stopped

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    restart: unless-stopped

volumes:
  keycloak_data:
  grafana_data:
```

### Step 4: Configure Prometheus

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'agentgateway'
    static_configs:
      - targets: ['agentgateway:15020']
```

### Step 5: Deploy and Verify

```bash
# Start all services
docker-compose up -d

# Check service health
docker-compose ps

# View Agent Gateway logs
docker-compose logs -f agentgateway
```

### Step 6: Access the Platform

| Interface | URL | Credentials |
|-----------|-----|-------------|
| Open WebUI | http://localhost:8888 | Create account or SSO |
| Agent Gateway UI | http://localhost:15000 | No auth required |
| Keycloak Admin | http://localhost:8090 | admin / admin |
| Grafana | http://localhost:3100 | admin / admin |
| Jaeger | http://localhost:16686 | No auth required |
| Prometheus | http://localhost:9090 | No auth required |

### Step 7: Configure Models in Open WebUI

After deployment, configure the models in Open WebUI:

1. Go to **Settings** → **Connections**
2. Add OpenAI connection pointing to `http://agentgateway:3000/v1`
3. Enable the models you want available to users

### Monitoring and Troubleshooting

**View traces in Jaeger:**
- Open http://localhost:16686
- Select "agentgateway" service
- View request traces across all providers

**View metrics in Grafana:**
- Open http://localhost:3100
- Import Agent Gateway dashboard
- Monitor request rates, latency, and token usage

**Common issues:**
- If models don't appear, verify Agent Gateway is running: `curl http://localhost:3000/v1/models`
- Check logs for API key issues: `docker-compose logs agentgateway`

### Production Considerations

For production deployments:

1. **Enable TLS** - Add SSL certificates for all external endpoints
2. **Secure secrets** - Use a secrets manager instead of `.env` files
3. **Configure SSO** - Set up proper Keycloak realm and client configuration
4. **Set resource limits** - Add CPU/memory limits to containers
5. **Enable persistence** - Mount volumes for Open WebUI conversation history
6. **Configure backups** - Back up Keycloak and PostgreSQL data
