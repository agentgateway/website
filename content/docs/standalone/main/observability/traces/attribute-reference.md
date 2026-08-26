---
title: Span attribute reference
weight: 20
description: Reference for the default HTTP, conditional, generative AI, and MCP span attributes emitted by agentgateway, including policy call child spans.
---

The following default attributes are included in each span. Note that protocol-specific attributes, such as `gen_ai.*` and `mcp.*`, only appear when that type of traffic is processed. You can [add custom attributes](setup/#add-attributes) to your spans or [remove default ones](setup/#remove-attributes).

## Core HTTP attributes

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

## Conditional attributes

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

## Generative AI attributes (LLM)

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

## MCP attributes

| Attribute | Description |
|-----------|-------------|
| `mcp.method.name` | MCP method (for example, `tools/call`) |
| `mcp.session.id` | MCP session identifier |

For the full list of MCP-specific attributes, see [Observe MCP traffic]({{< link-hextra path="/mcp/mcp-observability/" >}}).

## Policy call child spans {#policy-child-spans}

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
