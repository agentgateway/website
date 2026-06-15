---
title: OpenTelemetry
weight: 10
description: Integrate agentgateway with OpenTelemetry for distributed tracing and observability
---

Agentgateway natively supports OpenTelemetry (OTLP) for distributed tracing. You can also enable structured logging for request details. For metrics, agentgateway exposes a Prometheus-compatible `/metrics` endpoint. For more information, see [Prometheus metrics](/integrations/observability/prometheus/).

## Configuration

Enable OpenTelemetry tracing in your agentgateway configuration.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: true
```

## Configuration options

| Setting | Description |
|---------|-------------|
| `otlpEndpoint` | The OTLP gRPC endpoint (e.g., `http://localhost:4317`) |
| `randomSampling` | Set to `true` to sample every request. Useful in development when you want to capture all traces. |

### Sampling strategies

In development, set `randomSampling: true` to capture every trace. In production, sampling every request adds overhead, so sample a percentage of requests instead by setting `randomSampling` to a ratio between `0` and `1`. For example, the following configuration samples 10% of requests.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: "0.1"
```

## With Jaeger

Run Jaeger with OTLP support.

```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  jaegertracing/all-in-one:latest
```

Configure agentgateway.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
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
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/jaeger]
```

The example above exports traces to Jaeger via OTLP. Replace the `otlp/jaeger` endpoint with any OTLP-compatible backend.

## Trace attributes

Agentgateway includes the following attributes in traces. The list below is representative; attributes may vary by deployment mode and request type.

### Core attributes

- `gateway` - Gateway name
- `listener` - Listener name
- `route` - Route name
- `endpoint` - Backend endpoint
- `src.addr` - Source address
- `http.method` - HTTP request method
- `http.host` - Request host
- `http.path` - Request path
- `http.status` - Response status code (integer)
- `http.version` - HTTP version (e.g., `HTTP/1.1`)
- `trace.id` - Trace ID
- `span.id` - Span ID
- `protocol` - Protocol type (e.g., `http`, `mcp`)
- `duration` - Request duration
- `url.scheme` - URL scheme
- `network.protocol.version` - Network protocol version

For MCP-specific attributes such as `mcp.method.name` and `mcp.session.id`, see [MCP Observability](/mcp/mcp-observability/).

For LLM-specific attributes such as `gen_ai.operation.name` and `gen_ai.request.model`, see [LLM Observability](/llm/observability/).

## Learn more

{{< cards >}}
  {{< card path="/integrations/observability/jaeger" title="Jaeger" subtitle="Distributed tracing with Jaeger" >}}
  {{< card path="/integrations/observability/prometheus" title="Prometheus Metrics" subtitle="Metrics via Prometheus-compatible endpoint" >}}
  {{< card path="/mcp/mcp-observability" title="MCP Observability" subtitle="MCP-specific tracing and logging" >}}
  {{< card path="/llm/observability" title="LLM Observability" subtitle="AI-specific observability" >}}
{{< /cards >}}
