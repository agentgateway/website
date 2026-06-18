---
title: Release notes
weight: 20
description: Review the release notes for agentgateway.
test: skip
---

Review the release notes for agentgateway.

{{< callout type="info">}}
For more details, check out the [release blog](https://agentgateway.dev/blog/2026-06-17-agentgateway-v1.3.0/), or review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).
{{< /callout >}}

## 🔥 Breaking changes {#v13-breaking-changes}

### `agctl` commands reorganized under `proxy` and `controller`

The experimental `agctl` CLI now groups its inspection and management commands under the `proxy` and `controller` parent commands, and adds new commands for log-level management and version information. Update any scripts or automation that call the previous top-level commands.

Before:

```sh
agctl config all gateway/agentgateway-proxy -n agentgateway-system -o yaml
agctl config backends gateway/agentgateway-proxy -n agentgateway-system
agctl trace gateway/agentgateway-proxy -n agentgateway-system --port 80 -- http://www.example.com/
```

Now:

```sh
agctl proxy config all gateway/agentgateway-proxy -n agentgateway-system -o yaml
agctl proxy config backends gateway/agentgateway-proxy -n agentgateway-system
agctl proxy trace gateway/agentgateway-proxy -n agentgateway-system --port 80 -- http://www.example.com/
```

The reorganization also introduces the following new capabilities:

- `agctl proxy log` gets or sets the proxy log level at runtime. For more information, see [Debug your setup]({{< link-hextra path="/operations/debug/#debug-logs" >}}).
- `agctl controller log` gets or sets the agentgateway controller log level per component at runtime. For more information, see [Debug your setup]({{< link-hextra path="/operations/debug/#debug-logs" >}}).
- `agctl version` prints version information for the `agctl` CLI.

For more information, see [Install `agctl`]({{< link-hextra path="/operations/agctl/" >}}), [Inspect agentgateway configuration]({{< link-hextra path="/operations/inspect-config/" >}}), [Trace requests with `agctl`]({{< link-hextra path="/operations/trace-requests/" >}}), and the [`agctl` CLI reference]({{< link-hextra path="/reference/agctl/" >}}).

## 🌟 New features {#v13-new-features}

### New UI

A refreshed UI exposes the new LLM capabilities through LLM, MCP, and traffic-native views, aligned with the new model-based routing model. Configure providers, models, costs, and guardrails and inspect MCP and traffic configuration from one place.

### ExtMCP: MCP-aware external auth and processing

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1842 -->

External authorization and external processing integrations can now make decisions using MCP request context, such as the tool being called and its arguments, rather than only generic HTTP metadata. This change makes it possible to enforce fine-grained, MCP-aware policy in an external service. For more information, see the [MCP guardrail docs]({{< link-hextra path="/mcp/guardrails/">}}).

### External processing enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1787 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2010 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2071 -->

- **Per-phase processing modes**: Control whether headers, body, and trailers are sent to the ext_proc server for each phase, choose how the body is delivered (none, buffered, partially buffered, or full-duplex streamed), and optionally allow the ext_proc server to override the mode.
- **`ImmediateResponse` from body phases**: An ext_proc server can now return an `ImmediateResponse` from the request body and response body phases and have it returned to the client.

### Request buffering

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2017 -->

A new buffering policy can accumulate request and response bodies in memory before forwarding, with configurable size limits. This change enables policies and extensions that need full request-body access before backend selection or dispatch. For more information, see [Body buffering]({{< link-hextra path="/traffic-management/buffer/" >}}).

### Dynamic SSL certificates

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2134 -->

Dynamic SSL certificate support was added for listener TLS, improving certificate handling for deployments where serving certificates are supplied or rotated dynamically.

### LLM gateway enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2135 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/1932 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2039 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2164 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2128 -->

- **Rerank support**: Added rerank request and response support.
- **Custom LLM providers for InferencePool**: InferencePool backends can now use custom LLM providers.
- **AI backend policy composition**: Multiple AI backend policies can be composed on the same backend.
- **Per-model routing precision**: Model matching now prefers more exact matches, and the model can be detected from the request path when not set.
- **Per-model authorization**: LLM authorization can be configured per model, and `/v1/models` listings are gated by authorization.
- **Bedrock**: Detect-passthrough support, Application Inference Profile prompt-cache support, Anthropic beta header allowlisting, host override, URL-encoded model IDs, and reasoning-signature replay.
- **Anthropic**: Support for system messages and extra-high thinking.
- **Telemetry attributes**: LLM requests now expose latency and throughput attributes.

### MCP improvements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1831 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2100 -->

- Added Okta as a first-class MCP authentication provider.
- Added resource subscribe and unsubscribe support, and improved resource multiplexing.
- Advertised prompt, resource, and tool list-change capabilities.
- Added explicit service selector target names for MCP backends.

### Authorization and authentication

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2175 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/1844 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/1923 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/1946 -->

- Authorization can now run in the pre-routing phase, including CORS.
- External auth now supports caching, with a configurable cache key and a TTL that can be a duration or a CEL expression.
- External auth derives scheme from `X-Forwarded-Proto` and preserves invalid header values.
- Webhook guardrails support `failureMode` for fail-open or fail-closed behavior.

### Backend references, TLS, and policy attachment

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2131 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2081 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2142 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2056 -->

- Generalized backend references and added a `BackendReferenceGrantMode` setting to control reference-grant enforcement.
- Generalized and cleaned up backend TLS policy handling, including multi-gateway backend mTLS and config-dump visibility.
- Added policy inheritance strategy configuration.

### CEL enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2102 -->

- Added route metadata to the CEL context and gRPC status to the response context.
- Added raw JWT bearer token access via `jwt.rawToken`.
- Added URL encode/decode functions, timestamp conversion helpers, and bit operations on bytes.
- Added support for CEL expressions in direct responses and retry conditions, and mTLS certificate passthrough via CEL.

### Traffic, TLS, and networking

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1846 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2165 -->

- Added support for terminating inbound `CONNECT` requests.
- Added service route port filtering and HTTP/1 header-case preservation.
- Added case-insensitive WebSocket upgrade tokens.
- Added configurable admin interfaces, including disablement and Unix Domain Socket support.
- Added AWS AssumeRole support, custom AWS service names, and request-signing allowlists.
- Added custom `secretRef` group and kind options, and waypoint endpoint resolution for ingress-use-waypoint.
- Updated to Gateway API v1.6.0-rc.1.

### Operations and observability

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1784 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2061 -->

- Added proxy timing measurements and a configuration synchronization metric.
- Added request and connection IDs for troubleshooting.
- Improved distributed trace output, including JSON mode, raw-output file opening, body snapshots, effective gateway and route policies, and CEL expression registration.
