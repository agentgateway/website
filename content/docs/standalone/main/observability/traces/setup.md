---
title: Set up and customize traces
weight: 10 
description: "Configure tracing in agentgateway: enable OTLP export, set up authentication and TLS, control the sampling rate, filter spans, and customize span attributes."
---

Agentgateway natively exports distributed traces over OTLP (OpenTelemetry Protocol). Traces include HTTP, MCP, and LLM spans with attributes that follow the [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/).

## Enable tracing

To enable tracing in agentgateway, add a `tracing` block under the `frontendPolicies` section and point agentgateway to your OTLP-compatible backend. Because `frontendPolicies` is scoped per listener, you can apply different tracing configurations to different listeners. For sample tracing backend setups, see [Sample tracing configurations]({{< link path="/observability/traces/configs/" >}}).

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
    randomSampling: true
```

| Field | Description |
|-------|-------------|
| `host` | Hostname and port of the OTLP receiver. The value depends on your agentgateway installation method. For more information, see [Sample tracing backend configurations]({{< link path="/observability/traces/configs/" >}}). |
| `randomSampling` | `true` to sample every request, or a decimal between `0` and `1` for a percentage (for example, `0.1` for 10%). Defaults to `false` (no new traces initiated). For more information, see [Control sampling rate](#sampling). |

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


## Customize span attributes

Agentgateway emits standard OpenTelemetry attributes as shown in [Default span attributes](attribute-reference/). You can [add custom attributes](#add-attributes) to your spans or [remove default ones](#remove-attributes). Note that customizing span attributes does not work on policy call child spans. For more information, see [Policy call child spans](attribute-reference/#policy-child-spans). 

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