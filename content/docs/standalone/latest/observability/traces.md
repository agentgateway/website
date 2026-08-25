---
title: Traces
weight: 20
description: Export distributed traces from agentgateway over OTLP, with built-in OpenTelemetry semantic conventions for LLM and MCP traffic.
---

Agentgateway natively exports distributed traces over OTLP (OpenTelemetry Protocol). Traces include HTTP, MCP, and LLM spans with attributes that follow the [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/).

## Enable tracing

Add a `tracing` block under `frontendPolicies` in your agentgateway config file:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
    randomSampling: true
```

| Field | Description |
|-------|-------------|
| `host` | OTLP gRPC endpoint in `host:port` format. |
| `randomSampling` | `true` to sample every request. Set to a decimal between `0` and `1` to sample a percentage (for example, `"0.1"` for 10%). |

## Quick start with Jaeger

Run Jaeger locally:

```sh
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  -e COLLECTOR_OTLP_ENABLED=true \
  jaegertracing/all-in-one:latest
```

Configure agentgateway to send traces to Jaeger:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
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

Open the [Jaeger UI](http://localhost:16686/search) to view traces after sending a request.

## Trace attributes

Agentgateway emits standard OpenTelemetry attributes on every span.

### Core HTTP attributes

| Attribute | Description |
|-----------|-------------|
| `gateway` | Gateway name |
| `listener` | Listener name |
| `route` | Route name |
| `http.method` | HTTP request method |
| `http.host` | Request host |
| `http.path` | Request path |
| `http.status` | Response status code |
| `http.version` | HTTP version |
| `src.addr` | Client source address |
| `duration` | Request duration |

### Generative AI attributes (LLM)

These follow the [OTel semantic conventions for generative AI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/).

| Attribute | Description |
|-----------|-------------|
| `gen_ai.operation.name` | Operation type (for example, `chat`) |
| `gen_ai.provider.name` | LLM provider (for example, `openai`) |
| `gen_ai.request.model` | Requested model |
| `gen_ai.response.model` | Model that served the response |
| `gen_ai.usage.input_tokens` | Input token count |
| `gen_ai.usage.output_tokens` | Output token count |

For the full list of LLM-specific attributes, see [Observe LLM traffic]({{< link-hextra path="/llm/observability/" >}}).

### MCP attributes

| Attribute | Description |
|-----------|-------------|
| `mcp.method.name` | MCP method (for example, `tools/call`) |
| `mcp.session.id` | MCP session identifier |

For the full list of MCP-specific attributes, see [Observe MCP traffic]({{< link-hextra path="/mcp/mcp-observability/" >}}).

## Add custom span attributes

You can enrich spans with additional attributes computed from [CEL]({{< link-hextra path="/reference/cel/" >}}) expressions. This is useful for attaching business context such as user IDs or request metadata to your traces.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: true
    fields:
      add:
        user.id: 'request.headers["x-user-id"]'
        env: '"production"'
        gen_ai.request.model: "llm.requestModel"
        gen_ai.usage.input_tokens: "llm.inputTokens"
        gen_ai.usage.output_tokens: "llm.outputTokens"
```

The `config.tracing` block also supports additional options for authentication and protocol selection:

| Field | Description |
|-------|-------------|
| `otlpEndpoint` | Full OTLP URL including scheme and port (for example, `http://localhost:4317`). |
| `otlpProtocol` | `grpc` (default) or `http`. |
| `randomSampling` | `true` to sample all requests, or a decimal ratio. |
| `headers` | Map of headers to include in every OTLP export request (for example, API keys for SaaS backends). |
| `fields.add` | Map of span attribute names to CEL expressions. |

See the [CEL variables reference]({{< link-hextra path="/reference/cel/variables/" >}}) for the full list of available fields.

## Connect to SaaS observability backends

The `headers` field lets you authenticate with observability SaaS backends that require API keys.

### Langfuse

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  tracing:
    otlpEndpoint: https://us.cloud.langfuse.com/api/public/otel
    otlpProtocol: http
    randomSampling: true
    headers:
      Authorization: "Basic <base64-encoded-public-key:secret-key>"
    fields:
      add:
        gen_ai.operation.name: '"chat"'
        gen_ai.system: "llm.provider"
        gen_ai.request.model: "llm.requestModel"
        gen_ai.response.model: "llm.responseModel"
        gen_ai.usage.input_tokens: "llm.inputTokens"
        gen_ai.usage.output_tokens: "llm.outputTokens"
```

For more LLM observability platform integrations (Langsmith, Phoenix), see [LLM Observability integrations]({{< link-hextra path="/integrations/llm-observability/" >}}).

## Use the OpenTelemetry Collector

For production deployments, route traces through an OpenTelemetry Collector to fan out to multiple backends or apply processing pipelines.

The following collector configuration receives traces from agentgateway and exports them to Jaeger:

{{% github-yaml url="https://agentgateway.dev/examples/mcp-telemetry/otel-collector-config.yaml" %}}

Configure agentgateway to send to the collector's OTLP gRPC endpoint:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
    randomSampling: true
```

## Learn more

{{< cards >}}
  {{< card path="/observability/access-logs/" title="Access logs" subtitle="Per-request structured logs with OTLP export" >}}
  {{< card path="/integrations/observability/jaeger/" title="Jaeger" subtitle="Step-by-step Jaeger integration guide" >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="LLM-specific trace attributes and token logging" >}}
{{< /cards >}}
