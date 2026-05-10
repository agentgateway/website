---
title: Goose
description: Route Goose's LLM traffic through agentgateway to govern an autonomous agent's model and tool calls.
---

[Goose](https://github.com/block/goose) is an open-source, on-machine AI agent from Block that combines LLM reasoning with tool execution via the Model Context Protocol (MCP). Routing Goose's LLM calls through agentgateway gives you a single place to apply rate limits, capture audit logs, and switch providers without reconfiguring the agent.

## What you get

- A consistent OpenAI-compatible endpoint Goose can target with its `openai` provider, regardless of the upstream model.
- API keys held by agentgateway, not pasted into Goose's config file.
- Per-request metrics and access logs for every LLM call the agent makes.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      Goose      │────▶│   agentgateway  │────▶│  LLM provider   │
│      (CLI)      │     │   (port 3000)   │     │ (OpenAI, etc.)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/deployment/binary" >}}).
2. [Install Goose](https://github.com/block/goose/releases/latest) — download the CLI binary for your platform from the latest release.
3. Have an LLM provider API key, such as an [OpenAI API key](https://platform.openai.com/api-keys).

## Steps

{{% steps %}}

### Step 1: Configure agentgateway

Create a `config.yaml`:

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

### Step 2: Start agentgateway

```sh
export OPENAI_API_KEY='<your-api-key>'
agentgateway -f config.yaml
```

### Step 3: Point Goose at agentgateway

Goose reads provider settings from environment variables or from `~/.config/goose/config.yaml`. Configure Goose to use the OpenAI provider with agentgateway as the host.

```sh
export GOOSE_PROVIDER=openai
export GOOSE_MODEL=gpt-4o
export OPENAI_HOST=http://localhost:3000
export OPENAI_API_KEY=placeholder
```

`OPENAI_API_KEY` must be set for Goose to start, but it is not used to call OpenAI — agentgateway holds the real key. `GOOSE_MODEL` must also be set; Goose will not start without a model configured.

Equivalent `~/.config/goose/config.yaml`:

```yaml
GOOSE_PROVIDER: openai
GOOSE_MODEL: gpt-4o
OPENAI_HOST: http://localhost:3000
```

### Step 4: Run Goose

Start an interactive session:

```sh
goose session
```

Or send a one-shot prompt to verify the connection:

```sh
goose run --text "say hello"
```

Watch the agentgateway logs as Goose makes LLM calls to confirm requests are flowing through the gateway.

{{% /steps %}}

## Next steps

Goose can also use MCP servers as tools. To proxy and govern MCP tool calls through agentgateway, see the MCP setup guides.

{{< cards >}}
  {{< card path="/quickstart/mcp/" title="MCP quickstart" subtitle="Front an MCP server with agentgateway." >}}
  {{< card path="/llm/spending/" title="Control spending" subtitle="Apply rate limits to LLM and tool traffic." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs." >}}
{{< /cards >}}
