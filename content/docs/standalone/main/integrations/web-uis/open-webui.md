---
title: Open WebUI
description: Front Open WebUI with agentgateway to centralize auth, audit, and rate limits for LLM traffic.
---

[Open WebUI](https://github.com/open-webui/open-webui) is a self-hosted, ChatGPT-style interface that supports any OpenAI-compatible backend. By pointing Open WebUI at agentgateway instead of directly at an LLM provider, you keep API keys server-side and gain a single place to enforce policies and capture audit logs for every chat.

## What you get

- A single OpenAI-compatible endpoint that fronts one or more upstream providers (OpenAI, Anthropic, Gemini, xAI, and others).
- API keys held by agentgateway, not exposed to the browser or to Open WebUI's `.env`.
- Per-request metrics, traces, and access logs for every LLM call made from the chat UI.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Open WebUI    │────▶│   agentgateway  │────▶│  LLM provider   │
│   (port 8080)   │     │   (port 3000)   │     │ (OpenAI, etc.)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/deployment/binary" >}}) or have a container image available.
2. Get an API key from your LLM provider, such as an [OpenAI API key](https://platform.openai.com/api-keys).
3. Install [Docker](https://docs.docker.com/get-docker/) for running Open WebUI.

## Steps

{{% steps %}}

### Step 1: Configure agentgateway

Create a `config.yaml` that exposes an OpenAI-compatible endpoint on port 3000 and forwards requests to OpenAI.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

For other providers, see the [LLM provider integrations]({{< link-hextra path="/integrations/llm-providers/" >}}).

### Step 2: Start agentgateway

```sh
export OPENAI_API_KEY='<your-api-key>'
agentgateway -f config.yaml
```

Example output:

```
info  state_manager  loaded config from File("config.yaml")
info  app            serving UI at http://localhost:15000/ui
info  proxy::gateway started bind  bind="bind/3000"
```

### Step 3: Run Open WebUI pointing at agentgateway

Start Open WebUI with `OPENAI_API_BASE_URL` set to the agentgateway endpoint. Use `host.docker.internal` so the container can reach agentgateway running on your host.

```sh
docker run -d \
  -p 3080:8080 \
  -e OPENAI_API_BASE_URL=http://host.docker.internal:3000/v1 \
  -e OPENAI_API_KEY=placeholder \
  --add-host=host.docker.internal:host-gateway \
  --name open-webui \
  ghcr.io/open-webui/open-webui:main
```

`OPENAI_API_KEY` is required by Open WebUI but is not used to call the upstream provider; agentgateway holds the real key. Set it to any non-empty value.

### Step 4: Send a chat from Open WebUI

1. Open [http://localhost:3080](http://localhost:3080) and create the initial admin account.
2. Open a new chat. The model dropdown is populated from agentgateway's `/v1/models` response.
3. Send a message. The request flows to agentgateway, which forwards it to OpenAI.

### Step 5: Verify the request reached agentgateway

Watch the agentgateway logs as you send chat messages, or open the [agentgateway UI](http://localhost:15000/ui) to review live traffic.

{{% /steps %}}

## Run both with Docker Compose

To run agentgateway and Open WebUI together, use the following `docker-compose.yml`. Place your `config.yaml` next to it.

```yaml
services:
  agentgateway:
    image: ghcr.io/agentgateway/agentgateway:latest
    ports:
      - "3000:3000"
      - "15000:15000"
    volumes:
      - ./config.yaml:/etc/agentgateway/config.yaml:ro
    command: ["-f", "/etc/agentgateway/config.yaml"]
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}

  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "3080:8080"
    environment:
      - OPENAI_API_BASE_URL=http://agentgateway:3000/v1
      - OPENAI_API_KEY=placeholder
    depends_on:
      - agentgateway
    volumes:
      - open-webui:/app/backend/data

volumes:
  open-webui:
```

## Next steps

Layer policies and observability on top of the basic setup.

{{< cards >}}
  {{< card path="/llm/spending/" title="Control spending" subtitle="Apply rate limits and token budgets to LLM traffic." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs for every LLM call." >}}
  {{< card path="/llm/providers/" title="LLM providers" subtitle="Configure additional upstream providers." >}}
{{< /cards >}}
