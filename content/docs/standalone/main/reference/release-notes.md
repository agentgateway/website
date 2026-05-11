---
title: Release notes
weight: 20
description: Review the release notes for agentgateway standalone.
test: skip
---

Review the release notes for agentgateway standalone.

{{< callout type="info">}}
For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases)
{{< /callout >}}

## 🌟 New features {#v12-new-features}

### Conditional policy execution

Policies can now be selected conditionally using CEL expressions. Conditional execution is supported for external auth, transformations, rate limiting, external processing, and direct responses. The first matching policy is applied, with an optional final fallback entry. For more information, see [Conditional policies]({{< link-hextra path="/configuration/policies/conditional-policies/" >}}).

### Route delegation

Agentgateway now supports route delegation, allowing parent routes to delegate portions of their routing tree to child routes. Platform teams can own shared parent routes while application teams manage delegated route fragments. For more information, see [Route delegation]({{< link-hextra path="/configuration/traffic-management/route-delegation/" >}}).

### Policy targets

Policies can now target resources by label selector in addition to explicit attachment points. This makes it easier to apply shared policy configuration across groups of listeners, routes, or backends. For more information, see [Attachment points]({{< link-hextra path="/configuration/policies/attachment/" >}}).

### PROXY protocol support

Listeners now support downstream PROXY protocol handling, including strict and optional modes and PROXY protocol v1/v2 selection. For more information, see [Listeners]({{< link-hextra path="/configuration/listeners/" >}}).

### Locality load balancing and failover

The data plane now supports locality-aware load balancing and failover, improving traffic placement for multi-zone and multi-region deployments.

### LLM gateway enhancements

- **Azure provider**: A new Azure provider supports both Azure OpenAI and Azure AI Foundry style resources. For more information, see [Azure OpenAI]({{< link-hextra path="/integrations/llm-providers/azure-openai/" >}}).
- **Copilot support**: Added Copilot authentication and LLM provider support.
- **Gemini Responses API**: Responses API requests can now be routed to Gemini. For more information, see [Google Gemini]({{< link-hextra path="/integrations/llm-providers/gemini/" >}}).
- **Path prefixes**: Custom path prefixes now work across all LLM providers, including Gemini, Vertex, Bedrock, and Azure.
- **OpenAI compatibility**: OpenAI chat completion requests now normalize `max_tokens` to `max_completion_tokens`.
- **Azure Content Safety guardrails**: Prompt and response guardrails can now use Azure AI Content Safety.
- **Bedrock guardrails masking**: Bedrock guardrails now support masking. For more information, see [Amazon Bedrock]({{< link-hextra path="/integrations/llm-providers/bedrock/" >}}).

### MCP improvements

- **Session TTL**: MCP sessions can now be configured with an idle TTL. For more information, see [MCP connectivity]({{< link-hextra path="/mcp/" >}}).
- **Stateless MCP**: Stateless MCP initialization and shutdown behavior is improved.
- **List resources with multiplexing**: `ListResourcesRequest` now works with multiplexed MCP targets.

### Authentication and authorization

- **Backend external auth**: External auth can now run as a backend policy after backend selection. For more information, see [External authorization]({{< link-hextra path="/configuration/security/external-authz/" >}}).
- **Auth credential locations**: JWT, basic auth, API key, and backend auth can now override where credentials are read from or inserted, including headers, query parameters, and cookies. For more information, see [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}) and [API key authentication]({{< link-hextra path="/configuration/security/apikey-authn/" >}}).
- **Explicit GCP credentials**: GCP backend auth can now use explicit Secret-backed credentials. For more information, see [Backend authentication]({{< link-hextra path="/configuration/security/backend-authn/" >}}).

### Traffic, TLS, and networking

- **Post-quantum TLS**: TLS configuration now supports post-quantum key exchange groups, including `X25519_MLKEM768`. For more information, see [Listeners]({{< link-hextra path="/configuration/listeners/" >}}).
- **Max connection duration**: HTTP listeners can now enforce a maximum connection duration.
- **HTTP/2 pooling**: HTTP/2 connection pooling is improved to avoid the single-connection bottleneck.

### Operations

- **`agctl` CLI**: A new experimental command-line tool for inspecting and debugging agentgateway is now available. To install `agctl`, see [Install agctl]({{< link-hextra path="/operations/agctl/" >}}).
  - `agctl config` renders the runtime configuration that an agentgateway instance has loaded, including binds, listeners, routes, backends, and policies, as a structured table, JSON, or YAML. Pass the config dump as a file with `--file`. For more information, see [Inspect agentgateway configuration]({{< link-hextra path="/operations/inspect-config/" >}}).
  - `agctl trace` streams a step-by-step trace of how the proxy processes the next request, showing the matched route, applied policies, chosen backend, and response status. For more information, see [Trace requests with agctl]({{< link-hextra path="/operations/trace-requests/" >}}).
- Agentgateway's memory allocator performance is improved, resulting in increased runtime performance and decreased memory utilization.
- A new `/debug/pprof/heap` endpoint is available to get a `pprof` snapshot of current and historical allocations.

### Telemetry

- **Custom Prometheus labels**: Policies can add custom Prometheus metric labels using CEL expressions. For more information, see [Metrics]({{< link-hextra path="/reference/observability/metrics/" >}}).
- **OpenTelemetry environment variables**: OTEL configuration now respects standard environment variables. For more information, see [Traces]({{< link-hextra path="/reference/observability/traces/" >}}).

## 🪲 Notable fixes {#v12-fixes}

- Fixed A2A policy matching for agents hosted under sub-paths.
- Fixed A2A and MCP handling of `X-Forwarded-Proto`.
- Fixed phantom backend chains attaching policies to missing targets.
- Fixed JWKS stale fetches, startup fetch behavior, cache cleanup, and orphan cleanup.
- Fixed CEL property parsing after bracket accessors.
- Fixed CEL `response.body` access when upstream responses are compressed.
- Fixed request body buffering when CEL expressions do not need the body.
- Fixed `Host` and `:authority` alignment after header mutation.
- Fixed stripping of hop-by-hop connection headers and encoding headers for more consistent behavior.
- Fixed invalid htpasswd entries to fail gracefully instead of breaking basic auth handling.
- Fixed active stream accounting in the connection pool when debug assertions are disabled.
