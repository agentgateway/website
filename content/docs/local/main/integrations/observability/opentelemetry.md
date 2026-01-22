---
title: OpenTelemetry
weight: 10
description: Integrate Agent Gateway with OpenTelemetry for distributed tracing and metrics
---

Agent Gateway natively supports OpenTelemetry (OTLP) for distributed tracing and metrics export.

## Configuration

Enable OpenTelemetry tracing in your Agent Gateway configuration:

```yaml
config:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: true
```

## Configuration options

| Setting | Description |
|---------|-------------|
| `otlpEndpoint` | The OTLP gRPC endpoint (e.g., `http://localhost:4317`) |
| `randomSampling` | Enable random sampling for traces |

## With Jaeger

Run Jaeger with OTLP support:

```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  jaegertracing/all-in-one:latest
```

Configure Agent Gateway:

```yaml
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
          - name: my-server
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
```

View traces at [http://localhost:16686](http://localhost:16686).

## With OpenTelemetry Collector

For production deployments, use the OpenTelemetry Collector:

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  batch:

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [jaeger]
```

## Trace attributes

Agent Gateway includes the following attributes in traces:

- `http.method` - HTTP request method
- `http.url` - Request URL
- `http.status_code` - Response status code
- `mcp.method` - MCP method name (for MCP requests)
- `mcp.session_id` - MCP session ID
- `gen_ai.operation.name` - AI operation type (for LLM requests)
- `gen_ai.request.model` - Requested model
- `gen_ai.usage.input_tokens` - Input token count
- `gen_ai.usage.output_tokens` - Output token count

## Learn more

{{< cards >}}
  {{< card link="/docs/tutorials/telemetry" title="Telemetry Tutorial" subtitle="Step-by-step telemetry setup" >}}
  {{< card link="/docs/llm/observability" title="LLM Observability" subtitle="AI-specific observability" >}}
{{< /cards >}}
