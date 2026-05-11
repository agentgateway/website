---
title: Release notes
weight: 20
description: Review the release notes for agentgateway.
test: skip
---

Review the release notes for agentgateway.

{{< callout type="info">}}
For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases)
{{< /callout >}}

## 🔥 Breaking changes {#v12-breaking-changes}

### xDS Helm configuration changed

The controller Helm value for xDS TLS changed from a boolean to an explicit transport mode.

Previously:

```yaml
controller:
  xds:
    tls:
      enabled: true
```

Now use:

```yaml
controller:
  xds:
    mode: tls
```

Supported values are `plaintext`, `tls`, and `either`. The chart now defaults to `tls`, and the controller can automatically manage xDS TLS material. If you have automation that sets `controller.xds.tls.enabled`, update it to use `controller.xds.mode`. For more information, see [TLS encryption]({{< link-hextra path="/install/tls/" >}}).

## 🌟 New features {#v12-new-features}

### Conditional policy execution

Policies can now be selected conditionally using CEL expressions. Conditional execution is supported for external auth, transformations, rate limiting, external processing, and direct responses. The first matching policy is applied, with an optional final fallback entry. For more information, see [Conditional policies]({{< link-hextra path="/about/policies/conditional-policies/" >}}).

```yaml
traffic:
  transformation:
    conditional:
    - condition: request.headers["x-user"] == "admin"
      policy:
        request:
          set:
          - name: x-role
            value: admin
    - policy:
        request:
          set:
          - name: x-role
            value: user
```

### Automatic xDS TLS management

Kubernetes installs can now run xDS over TLS without requiring users to pre-create serving certificates. The controller creates and rotates a local CA and short-lived serving certificates, while still supporting user-provided certificates. For more information, see [TLS encryption]({{< link-hextra path="/install/tls/" >}}).

### Route delegation

Agentgateway now supports Gateway API route delegation, allowing parent routes to delegate portions of their routing tree to child routes. Platform teams can own shared parent routes while application teams manage delegated route fragments. For more information, see [Route delegation]({{< link-hextra path="/traffic-management/route-delegation/overview/" >}}).

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: parent
  namespace: default
spec:
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /anything/team1
    backendRefs:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      name: "*"
      namespace: team1
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: child-team1-foo
  namespace: team1
spec:
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /anything/team1/foo
    backendRefs:
    - name: httpbin
      port: 8000
```

### Policy targets

`AgentgatewayPolicy` can now target resources by label selector in addition to explicit target references. This makes it easier to apply shared policy configuration across groups of Gateways, Routes, Services, or Backends.

Additionally, `AgentgatewayPolicy` can now target `ListenerSet` and `InferencePool` resources. For more information, see [Targeting and merging]({{< link-hextra path="/about/policies/target-merge/" >}}).

### PROXY protocol support

Kubernetes and proxy listeners now support downstream PROXY protocol handling, including strict and optional modes and PROXY protocol v1/v2 selection. For more information, see [Listener overview]({{< link-hextra path="/setup/listeners/overview/" >}}).

### Locality load balancing and failover

The data plane now supports locality-aware load balancing and failover, improving traffic placement for multi-zone and multi-region deployments. For more information, see [Locality-aware routing]({{< link-hextra path="/traffic-management/locality-aware-routing/" >}}).

### LLM gateway enhancements

- **Azure provider**: A new Azure provider supports both Azure OpenAI and Azure AI Foundry style resources. For more information, see [Azure]({{< link-hextra path="/llm/providers/azure/" >}}).
- **Copilot support**: Added Copilot authentication and LLM provider support.
- **Gemini Responses API**: Responses API requests can now be routed to Gemini. For more information, see [Gemini]({{< link-hextra path="/llm/providers/gemini/" >}}).
- **Path prefixes**: Custom path prefixes now work across all LLM providers, including Gemini, Vertex, Bedrock, and Azure.
- **OpenAI compatibility**: OpenAI chat completion requests now normalize `max_tokens` to `max_completion_tokens`.
- **Azure Content Safety guardrails**: Prompt and response guardrails can now use Azure AI Content Safety. For more information, see [Guardrails]({{< link-hextra path="/llm/guardrails/overview/" >}}).
- **Bedrock guardrails masking**: Bedrock guardrails now support masking. For more information, see [AWS Bedrock Guardrails]({{< link-hextra path="/llm/guardrails/bedrock-guardrails/" >}}).

### MCP improvements

- **Session TTL**: MCP sessions can now be configured with an idle TTL. For more information, see [MCP sessions]({{< link-hextra path="/mcp/session/" >}}).
- **Stateless MCP**: Stateless MCP initialization and shutdown behavior is improved.
- **List resources with multiplexing**: `ListResourcesRequest` now works with multiplexed MCP targets.

### Authentication and authorization

- **Backend external auth**: External auth can now run as a backend policy after backend selection. For more information, see [External auth]({{< link-hextra path="/security/extauth/" >}}).
- **Auth credential locations**: JWT, basic auth, API key, and backend auth can now override where credentials are read from or inserted, including headers, query parameters, and cookies. For more information, see [JWT auth]({{< link-hextra path="/security/jwt/" >}}) and [API key auth]({{< link-hextra path="/security/apikey/" >}}).
- **Explicit GCP credentials**: GCP backend auth can now use explicit Secret-backed credentials.

### Traffic, TLS, and networking

- **Post-quantum TLS**: TLS configuration now supports post-quantum key exchange groups, including `X25519_MLKEM768`. For more information, see [Additional TLS settings]({{< link-hextra path="/setup/listeners/tls-settings/" >}}).
- **Istio workload TLS**: Listeners can use Istio workload certificates for simple TLS or mutual TLS. For more information, see [mTLS]({{< link-hextra path="/setup/listeners/mtls/" >}}).
- **HBONE gateway tunnel protocol**: Controller support was added for the `HBONE_GATEWAY` tunnel protocol.
- **Unix Domain Socket backends**: Kubernetes static backends can now target Unix Domain Sockets.
- **Max connection duration**: HTTP listeners can now enforce a maximum connection duration.
- **HTTP/2 pooling**: HTTP/2 connection pooling is improved to avoid the single-connection bottleneck.

### Operations

- **`agctl` CLI**: A new experimental command-line tool for inspecting and debugging agentgateway is now available. To install `agctl`, see [Install agctl]({{< link-hextra path="/operations/agctl/" >}}).
  - `agctl config` renders the runtime configuration that an agentgateway proxy has loaded, including binds, listeners, routes, backends, workloads, and policies, as a structured table, JSON, or YAML. `agctl config backends` shows per-backend health, request counts, and latency. For more information, see [Inspect agentgateway configuration]({{< link-hextra path="/operations/inspect-config/" >}}).
  - `agctl trace` streams a step-by-step trace of how the proxy processes the next request, showing the matched route, applied policies, chosen backend, and response status. For more information, see [Trace requests with agctl]({{< link-hextra path="/operations/trace-requests/" >}}).
  - For a complete command reference, see [agctl CLI reference]({{< link-hextra path="/reference/agctl/" >}}).
- Agentgateway's memory allocator performance is improved, resulting in increased runtime performance and decreased memory utilization.
- A new `/debug/pprof/heap` endpoint is available to get a `pprof` snapshot of current and historical allocations.

### Telemetry

- **Custom Prometheus labels**: `AgentgatewayPolicy` can add custom Prometheus metric labels using CEL expressions.
- **OpenTelemetry environment variables**: OTEL configuration now respects standard environment variables. For more information, see [OTel stack]({{< link-hextra path="/observability/otel-stack/" >}}).

## 🪲 Notable fixes {#v12-fixes}

- Fixed A2A policy matching for agents hosted under sub-paths.
- Fixed A2A and MCP handling of `X-Forwarded-Proto`.
- Fixed service parents and arbitrary parents in route delegation.
- Fixed phantom backend chains attaching policies to missing targets.
- Fixed JWKS stale fetches, startup fetch behavior, cache cleanup, and orphan cleanup.
- Fixed CEL property parsing after bracket accessors.
- Fixed CEL `response.body` access when upstream responses are compressed.
- Fixed request body buffering when CEL expressions do not need the body.
- Fixed `Host` and `:authority` alignment after header mutation.
- Fixed stripping of hop-by-hop connection headers and encoding headers for more consistent behavior.
- Improved xDS error semantics for regex, CEL, and rate-limit-service failures.
- Improved Gateway status updates to avoid unnecessary churn while preserving transition times.
- Fixed invalid htpasswd entries to fail gracefully instead of breaking basic auth handling.
- Fixed active stream accounting in the connection pool when debug assertions are disabled.
