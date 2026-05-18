---
title: Goose
description: Route Goose's LLM traffic through agentgateway to govern an autonomous agent's model and tool calls.
---

[Goose](https://github.com/aaif-goose/goose) is an open-source, on-machine AI agent from Block that combines LLM reasoning with tool execution via the Model Context Protocol (MCP). Routing Goose's LLM calls through agentgateway gives you a single place to apply rate limits, capture audit logs, and switch providers without reconfiguring the agent.

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
2. Install Goose by following the [Goose installation guide](https://goose-docs.ai/docs/getting-started/installation/).
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

The following table describes each environment variable:

| Variable | Description |
|---|---|
| `GOOSE_PROVIDER` | The LLM provider Goose uses. Set to `openai` so Goose speaks the OpenAI-compatible API. |
| `GOOSE_MODEL` | The model to use. Must be set — Goose will not start without a model configured. |
| `OPENAI_HOST` | The base URL of the agentgateway proxy. |
| `OPENAI_API_KEY` | Must be non-empty for Goose to start, but it is not used to call OpenAI — agentgateway holds the real key. |

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

Watch the agentgateway logs as Goose makes LLM calls. You should see a log entry showing the request was forwarded to the OpenAI endpoint with the configured model:

```
info  request gateway=default/default listener=llm route=internal/model:* endpoint=api.openai.com:443 http.method=POST http.path=/v1/chat/completions http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai gen_ai.request.model=gpt-4o gen_ai.usage.input_tokens=4419 gen_ai.usage.output_tokens=10 duration=2195ms
```

{{% /steps %}}

## Next steps

Goose can also use MCP servers as tools. To proxy and govern MCP tool calls through agentgateway, see the MCP setup guides.

{{< cards >}}
  {{< card path="/quickstart/mcp/" title="MCP quickstart" subtitle="Front an MCP server with agentgateway." >}}
  {{< card path="/llm/spending/" title="Control spending" subtitle="Apply rate limits to LLM and tool traffic." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs." >}}
{{< /cards >}}
