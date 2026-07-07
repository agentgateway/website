---
title: OpenTelemetry
weight: 10
description: Integrate agentgateway with OpenTelemetry for distributed tracing and observability
---

Agentgateway natively supports OpenTelemetry (OTLP) for distributed tracing. You can also enable structured logging for request details. For metrics, agentgateway exposes a Prometheus-compatible `/metrics` endpoint. For more information, see [Prometheus metrics]({{< link-hextra path="/integrations/observability/prometheus/" >}}).

## Configuration

Enable OpenTelemetry tracing in your agentgateway configuration.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
    randomSampling: true
```

## Configuration options

| Setting | Description |
|---------|-------------|
| `host` | The hostname or IP address and port of the OTLP gRPC endpoint, such as `localhost:4317`. |
| `randomSampling` | Set to `true` to sample every request. Useful in development when you want to capture all traces. |

### Sampling strategies

In development, set `randomSampling: true` to capture every trace. In production, sampling every request adds overhead, so sample a percentage of requests instead by setting `randomSampling` to a ratio between `0` and `1`. For example, the following configuration samples 10% of requests.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
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

Configure agentgateway. The following configuration is from the [`mcp-telemetry` example](https://github.com/agentgateway/agentgateway/tree/main/examples/mcp-telemetry) in the agentgateway repository.

{{% github-yaml url="https://agentgateway.dev/examples/mcp-telemetry/config.yaml" %}}

View traces at [http://localhost:16686](http://localhost:16686).

## With OpenTelemetry Collector

For production deployments, use the OpenTelemetry Collector.

The following collector configuration from the [`mcp-telemetry` example](https://github.com/agentgateway/agentgateway/tree/main/examples/mcp-telemetry) exports traces to Jaeger via OTLP. Replace the `otlp/jaeger` endpoint with any OTLP-compatible backend. The example also includes a [Compose file](https://github.com/agentgateway/agentgateway/blob/main/examples/mcp-telemetry/docker-compose.yaml) that runs the collector and Jaeger together.

{{% github-yaml url="https://agentgateway.dev/examples/mcp-telemetry/otel-collector-config.yaml" %}}

## Trace attributes

Agentgateway includes the following attributes in traces. The list below is representative; attributes might vary by deployment mode and request type.

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

For MCP-specific attributes such as `mcp.method.name` and `mcp.session.id`, see [MCP Observability]({{< link-hextra path="/mcp/mcp-observability/" >}}).

For LLM-specific attributes such as `gen_ai.operation.name` and `gen_ai.request.model`, see [LLM Observability]({{< link-hextra path="/llm/observability/" >}}).

## Learn more

{{< cards >}}
  {{< card path="/integrations/observability/jaeger" title="Jaeger" subtitle="Distributed tracing with Jaeger" >}}
  {{< card path="/integrations/observability/prometheus" title="Prometheus Metrics" subtitle="Metrics via Prometheus-compatible endpoint" >}}
  {{< card path="/mcp/mcp-observability" title="MCP Observability" subtitle="MCP-specific tracing and logging" >}}
  {{< card path="/llm/observability" title="LLM Observability" subtitle="AI-specific observability" >}}
{{< /cards >}}
