---
title: Telemetry & Observability
weight: 6
description: Enable OpenTelemetry tracing and metrics for Agent Gateway
---

Agent Gateway has built-in OpenTelemetry support for distributed tracing, metrics, and logs. This tutorial shows you how to enable telemetry and visualize it with Jaeger.

## What you'll build

In this tutorial, you'll:
1. Enable OpenTelemetry tracing in Agent Gateway
2. Set up Jaeger for trace visualization
3. View traces for MCP tool calls and LLM requests
4. Access Prometheus-compatible metrics
5. Configure sampling strategies for production

## Prerequisites

- [Docker](https://docs.docker.com/get-started/get-docker/) installed (for Jaeger)
- [Node.js](https://nodejs.org/) installed (for MCP servers)

## Step 1: Install Agent Gateway

```bash
curl -sL https://agentgateway.dev/install | bash
```

## Step 2: Start Jaeger

Jaeger is an open-source distributed tracing platform. Start it with Docker:

```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  jaegertracing/all-in-one:latest
```

This exposes:
- **Port 16686**: Jaeger UI for viewing traces
- **Port 4317**: OTLP gRPC endpoint for receiving traces

## Step 3: Create the config

Create a directory for this tutorial:

```bash
mkdir telemetry-tutorial && cd telemetry-tutorial
```

Create a configuration file with tracing enabled:

```bash
cat > config.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: true

binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        cors:
          allowOrigins: ["*"]
          allowHeaders: ["*"]
          exposeHeaders: ["Mcp-Session-Id"]
      backends:
      - mcp:
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
EOF
```

Key configuration:
- `config.tracing.otlpEndpoint`: Where to send traces (Jaeger's OTLP endpoint)
- `config.tracing.randomSampling: true`: Sample all requests (for testing)

## Step 4: Start Agent Gateway

```bash
agentgateway -f config.yaml
```

You should see output including:
```
INFO agent_core::trcng initializing tracer endpoint="http://localhost:4317"
INFO agentgateway: Listening on 0.0.0.0:3000
```

## Step 5: Generate some traces

Open the Agent Gateway Playground at [http://localhost:15000/ui/playground](http://localhost:15000/ui/playground):

1. Click **Connect** to connect to your MCP server
2. Select the **echo** tool from Available Tools
3. Enter a message and click **Run Tool**
4. Repeat a few times to generate multiple traces

You'll see log entries with trace IDs:
```
INFO request ... trace.id=286cb6c44380a45e1f77f29ce4d146fd span.id=f7f30629c29d9089 protocol=mcp mcp.method=initialize
```

## Step 6: View traces in Jaeger

Open the Jaeger UI at [http://localhost:16686](http://localhost:16686):

1. Select **agentgateway** from the Service dropdown
2. Click **Find Traces**
3. Click on a trace to see the full request flow

You'll see spans for:
- `initialize` - MCP session initialization
- `list_tools` - Tool discovery
- `call_tool` - Individual tool executions

---

## Viewing Metrics

Agent Gateway exposes Prometheus-compatible metrics on port 15020:

```bash
curl -s http://localhost:15020/metrics | head -50
```

### MCP-specific metrics

Look for these metrics for MCP tool usage:

```bash
curl -s http://localhost:15020/metrics | grep -E "tool|mcp"
```

Key metrics include:
- `list_calls_total` - Number of tool calls by server and tool name
- Request latency histograms
- Active connection counts

### LLM-specific metrics

When using the LLM gateway, look for:

```bash
curl -s http://localhost:15020/metrics | grep gen_ai
```

Key LLM metrics:
- `agentgateway_gen_ai_client_token_usage` - Token usage by request/response
- Includes labels for provider, model, and operation

---

## LLM Observability

To trace LLM requests, use a config like this:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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

LLM traces include:
- Request and response token counts
- Model information
- Latency breakdown

Log entries show LLM-specific information:
```
INFO request ... llm.provider=openai llm.request.model=gpt-4o-mini llm.request.tokens=11 llm.response.tokens=331 duration=4305ms
```

---

## Sampling Strategies

### Random Sampling (all traces - for development)

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: true
```

### Ratio-based Sampling (for production)

Sample a percentage of traces to reduce overhead:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  tracing:
    otlpEndpoint: http://localhost:4317
    ratioSampling: 0.1  # Sample 10% of traces
```

---

## Access Logging

Enrich access logs with custom fields from JWT claims or MCP context:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      user: 'jwt.sub'
      tool: 'mcp.tool'

config:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: true

binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
```

---

## Cleanup

Stop and remove the Jaeger container:

```bash
docker stop jaeger && docker rm jaeger
```

## Next steps

{{< cards >}}
  {{< card link="/docs/mcp/mcp-observability" title="MCP Observability" subtitle="MCP-specific metrics and traces" >}}
  {{< card link="/docs/llm/observability" title="LLM Observability" subtitle="LLM-specific metrics and traces" >}}
  {{< card link="/docs/reference/observability/traces" title="Tracing Reference" subtitle="Complete tracing options" >}}
{{< /cards >}}
