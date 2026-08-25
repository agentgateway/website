---
title: Traces
weight: 20
description: Export distributed traces from agentgateway over OTLP, with built-in OpenTelemetry semantic conventions for LLM and MCP traffic.
---

Agentgateway natively exports distributed traces over OTLP (OpenTelemetry Protocol). Traces include HTTP, MCP, and LLM spans with attributes that follow the [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/).

## Enable tracing

To enable tracing in agentgateway, add a `tracing` block under the `frontendPolicies` section and point agentgateway to your OTLP-compatible backend. Because `frontendPolicies` is scoped per listener, you can apply different tracing configurations to different listeners. For sample tracing backend setups, see [Sample tracing configurations](#configs).

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
    randomSampling: true
```

| Field | Description |
|-------|-------------|
| `host` | Hostname and port of the OTLP receiver. The value depends on your agentgateway installation method. For more information, see [Sample tracing backend configurations](#configs). |
| `randomSampling` | `true` to sample every request, or a decimal between `0` and `1` for a percentage (for example, `0.1` for 10%). Defaults to `false` (no new traces initiated). For more information, see [Control sampling rate](#sampling). |
| `attributes` | Map of span attribute names to CEL expressions. Evaluated per request and added as tags to each span. |
| `resources` | Map of resource attribute names to CEL expressions. Applied at the tracer provider level and shared across all spans. Use `service.name` to set the service name shown in your tracing backend. |
| `remove` | List of span attribute keys to remove before `attributes` is evaluated. Use to drop default or duplicate attributes. |

## Set up authentication and TLS

When connecting to an OTLP backend that requires authentication, such as a SaaS observability platform, use the `policies.requestHeaderModifier` section to add required authentication headers and `policies.backendTLS` to enable TLS for the connection.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: <your-otlp-endpoint>.com:443
    protocol: http
    randomSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          Authorization: "Basic <api-key>"
```

| Field | Description |
|-------|-------------|
| `policies.requestHeaderModifier.set` | Headers to set on every OTLP export request. Use this to pass API keys or auth tokens to your backend. |
| `policies.backendTLS` | TLS settings for the backend connection. Set to `{}` to use TLS with system CAs (required for public HTTPS endpoints). |

## Control sampling rate {#sampling}

Use the `randomSampling` setting to control the fraction of requests for which spans are exported. Set `randomSampling: true` to sample 100% of requests, or provide a decimal between `0` and `1` for a percentage.

In the following example, you want to samply 10% of requests. 

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
    randomSampling: 0.1   # sample 10% of requests
```

## Filter spans

Use the `filter` field to write a [CEL]({{< link-hextra path="/reference/cel/" >}}) expression that controls which sampled spans are exported. A span is exported only when the expression evaluates to `true`. The filter runs after sampling, so it only evaluates spans that were already selected by `randomSampling`.

The following example exports only spans for requests with an HTTP response code of 400 or greater. 

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
    randomSampling: true
    filter: 'response.code >= 400'
```

You can combine conditions to export specific traffic. The following examples show common filter patterns:

| Goal | CEL expression |
|------|----------------|
| Export only errors | `response.code >= 400` |
| Export only LLM requests | `gen_ai.provider != ""` |
| Export by user | `request.headers["x-user-id"] == "user-123"` |
| Export errors or slow requests | `response.code >= 400 \|\| duration > 5000` |

For the full list of available CEL variables, see the [CEL variables reference]({{< link-hextra path="/reference/cel/variables/" >}}).

## Default span attributes

The following default attributes are included in each span. Note that protocol-specific attributes, such as `gen_ai.*` and `mcp.*`, only appear when that type of traffic is processed. You can [add custom attributes](#add-attributes) to your spans or [remove default ones](#remove-attributes).

### Core HTTP attributes

| Attribute | Description |
|-----------|-------------|
| `gateway` | Gateway name |
| `listener` | Listener name |
| `route` | Route name |
| `endpoint` | Backend endpoint address |
| `protocol` | Backend protocol (for example, `llm`, `mcp`, `http`) |
| `http.method` | HTTP request method |
| `http.host` | Request host |
| `http.path` | Request path |
| `http.status` | Response status code |
| `http.version` | HTTP version |
| `src.addr` | Client source address |
| `trace.id` | Trace ID of the outgoing span |
| `span.id` | Span ID of the outgoing span |
| `duration` | Request duration |

### Conditional attributes

These attributes are only present when the relevant feature or traffic type is active.

| Attribute | When present | Description |
|-----------|-------------|-------------|
| `grpc.status` | gRPC traffic | gRPC status code from the response |
| `tls.sni` | TLS connections without an HTTP `Host` header | TLS SNI value from the connection |
| `src.identity` | mTLS traffic | Client certificate identity |
| `jwt.sub` | JWT authentication | The `sub` claim from the JWT token |
| `route_rule` | Route has a named rule | Rule name within the matched route |
| `error` | Proxy errors | Proxy error message |
| `reason` | Non-upstream proxy responses | Response reason (for example, rate-limited or auth-rejected) |
| `retry.attempt` | When a retry occurred | Retry attempt number |

### Generative AI attributes (LLM)

These attributes follow the [OTel semantic conventions for generative AI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/).

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

### Policy call child spans {#policy-child-spans}

When agentgateway makes outbound calls to policy services, such as external authorization (ext_authz), rate limiting, guardrails, or OAuth token exchange, each call appears as a child span that is nested under the parent request span.

Each policy child span includes the following attributes:

| Attribute | Description |
|-----------|-------------|
| `agentgateway.outbound.kind` | Always `Policy` for policy call spans. |
| `agentgateway.outbound.subtype` | Policy type: `ext_authz`, `ext_proc`, `guardrail`, `rate_limit`, or `oidc`. |
| `http.method` | HTTP method of the outbound call. Always `POST` for gRPC policy calls. |
| `http.host` | Hostname of the policy service. |
| `http.path` | gRPC method path for the policy call. |
| `http.status` | HTTP response status code. Set on success. |
| `error.type` | Error type string. Set on failure, along with the span error status. |

> [!NOTE]
> The `filter`, `attributes`, and `remove` settings behave differently for policy child spans than for the parent request span:
> - **`filter`**: Applies to the entire trace. If the filter drops the parent span, all policy child spans are dropped with it. You cannot selectively filter individual policy spans.
> - **`attributes`**: Added only to the parent request span. Policy child spans have a fixed attribute set and are not affected by your `attributes` config.
> - **`remove`**: Removes attributes only from the parent request span. The fixed attributes on policy child spans cannot be removed.

## Customize span attributes

Agentgateway emits standard OpenTelemetry attributes as shown in [Default span attributes](#default-span-attributes). You can [add custom attributes](#add-attributes) to your spans or [remove default ones](#remove-attributes). Note that customizing span attributes does not work on policy call child spans. For more information, see [Policy call child spans](#policy-child-spans). 

### Add span and resource attributes {#add-attributes}

Use the `attributes` field to add custom tags to individual spans. Attribute values are evaluated as CEL expressions on every request, so they can be dynamic. For example, you can use a CEL expression to add the user ID from a request header or the HTTP response code. 

Use the `resources` field to describe the agentgateway process itself. Resource values are static values that are added to every span. For example, you can add the name of the agentgateway process, the environment it runs in, what version it is. Your tracing backend uses resource attributes to label and group spans in its service list. The most common resource attribute is `service.name`, which sets the name that is displayed in your tracing backend. It defaults to `agentgateway` if not set.

The following example sets a custom service name and deployment environment in `resources`, and adds the user ID and request path to each individual span by using `attributes`. 

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
    randomSampling: true
    resources:
      service.name: '"my-agentgateway"'
      deployment.environment: '"production"'
    attributes:
      user.id: 'request.headers["x-user-id"]'
      request.path: 'request.path'
```

### Remove span attributes {#remove-attributes}

Use the `remove` field to drop attributes from spans before your `attributes` expressions are applied. This setting is useful for stripping default attributes that are redundant or that you do not want to export.

The following example removes the HTTP version and source address from the span. 

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
    randomSampling: true
    remove:
      - src.addr
      - http.version
```

## Sample tracing backend configurations {#configs}

Agentgateway exports traces to any OTLP-compatible backend. The `host` value in `frontendPolicies.tracing` depends on how you installed agentgateway and where your OTLP receiver is running.

| Install method | `host` value | Notes |
|----------------|--------------|-------|
| Binary | `localhost:4317` | Run the OTLP receiver as a separate process or Docker container on the same host. |
| Docker Compose | `<service-name>:4317` | Add the receiver as a service that runs alongside agentgateway. Use the Docker service name as the host. |
| Kubernetes (Helm) | `<service>.<namespace>.svc.cluster.local:4317` | Deploy the OTLP receiver as a separate Helm release. For example, you can install the Jaeger Helm chart that includes an OTLP receiver and the Jaeger UI to view your traces. Use the Kubernetes service DNS name as your host. |

### Jaeger

[Jaeger](https://www.jaegertracing.io/) is a quick way to collect and visualize traces locally. It includes a built-in OTLP receiver and a web UI.

{{< tabs >}}
{{% tab name="Binary and Docker" %}}

1. Start a Jaeger container on the same host that agentgateway runs. 
   ```sh
   docker run -d --name jaeger \
     -p 16686:16686 \
     -p 4317:4317 \
     -e COLLECTOR_OTLP_ENABLED=true \
     jaegertracing/all-in-one:latest
   ```

2. Point agentgateway at the Jaeger endpoint. 
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   frontendPolicies:
     tracing:
       host: localhost:4317
       randomSampling: true
   ```

3. Open the Jaeger UI at [http://localhost:16686](http://localhost:16686) to view traces.

4. When you are done, remove the Jaeger container.
   ```sh
   docker rm -f jaeger
   ```

{{% /tab %}}
{{% tab name="Kubernetes (Helm)" %}}

1. Install the Jaeger Helm chart. 
   ```sh
   helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
   helm install jaeger jaegertracing/jaeger -n monitoring --create-namespace
   ```

2. Verify that the pods are up and running. 
   ```sh
   kubectl get pods -n monitoring
   ```

3. Update your agentgateway config to point at the Jaeger collector service.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   frontendPolicies:
     tracing:
       host: jaeger-collector.monitoring.svc.cluster.local:4317
       randomSampling: true
   ```

4. Apply the change with a Helm upgrade.
   ```sh
   helm upgrade agentgateway agentgateway/agentgateway -n <namespace> -f values.yaml
   ```

5. When you are done, remove Jaeger and the monitoring namespace.
   ```sh
   helm uninstall jaeger -n monitoring
   kubectl delete namespace monitoring
   ```

{{% /tab %}}
{{< /tabs >}}

{{% details title="Docker Compose example" closed="true" %}}

To run agentgateway and Jaeger together as a single stack, use Docker Compose instead of individual containers.

```yaml
services:
  agentgateway:
    image: cr.agentgateway.dev/agentgateway:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/config.yaml:ro
    command: ["-f", "/config.yaml"]
    depends_on:
      - jaeger

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"
      - "4317:4317"
    environment:
      - COLLECTOR_OTLP_ENABLED=true
```

{{% /details %}}

### SaaS observability backends

SaaS observability backends, such as Langfuse, are cloud-hosted services that require no local infrastructure and expose a public OTLP endpoint over HTTPS. Use `policies.requestHeaderModifier` to pass authentication credentials and `policies.backendTLS` to enable TLS. The same agentgateway configuration works regardless of whether you run the binary, Docker, or Helm.

**Langfuse:**

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: us.cloud.langfuse.com:443
    protocol: http
    path: /api/public/otel
    randomSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          Authorization: "Basic <base64-encoded-public-key:secret-key>"
    attributes:
      gen_ai.operation.name: '"chat"'
      gen_ai.system: "llm.provider"
      gen_ai.request.model: "llm.requestModel"
      gen_ai.response.model: "llm.responseModel"
      gen_ai.usage.input_tokens: "llm.inputTokens"
      gen_ai.usage.output_tokens: "llm.outputTokens"
```

For more LLM observability platform integrations, see [LLM Observability integrations]({{< link-hextra path="/integrations/llm-observability/" >}}).

### OpenTelemetry Collector

For production deployments, route traces through an [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) so that you can fan out to multiple backends or apply processing pipelines to your traces before forwarding them to your tracing backend. Replace the endpoint with the appropriate address for your install method.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    # Binary:     localhost:4317
    # Docker:     otel-collector:4317
    # Kubernetes: otel-collector.monitoring.svc.cluster.local:4317
    host: localhost:4317
    randomSampling: true
```

The following example shows a minimal OTel collector configuration that receives traces from agentgateway and exports them to Jaeger:

{{% github-yaml url="https://agentgateway.dev/examples/mcp-telemetry/otel-collector-config.yaml" %}}