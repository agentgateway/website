---
title: Release notes
weight: 20
description: Review the release notes for agentgateway standalone.
test: skip
---

Review the release notes for agentgateway standalone.

{{< callout type="info">}}
For more details, check out the [release blog](https://agentgateway.dev/blog/2026-06-17-agentgateway-v1.3.0/), or review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).
{{< /callout >}}

## 🔥 Breaking changes {#v13-breaking-changes}

### `agctl` commands reorganized under `proxy` and `controller`

The experimental `agctl` CLI now groups its inspection and tracing commands under the `proxy` parent command, and adds new commands for log-level management and version information. Update any scripts or automation that call the previous top-level commands.

Before:

```sh
agctl config all --file /tmp/agw-dump.json -o yaml
agctl trace --local --port 3000 -- http://example.com/headers
```

Now:

```sh
agctl proxy config all --file /tmp/agw-dump.json -o yaml
agctl proxy trace --local --port 3000 -- http://example.com/headers
```

The reorganization also introduces the following new capabilities:

- `agctl version` prints version information for the `agctl` CLI.
- `agctl proxy log` and `agctl controller log` get or set log levels at runtime for agentgateway running in Kubernetes.

For more information, see [Install `agctl`]({{< link-hextra path="/operations/agctl/" >}}), [Inspect agentgateway configuration]({{< link-hextra path="/operations/inspect-config/" >}}), [Trace requests with `agctl`]({{< link-hextra path="/operations/trace-requests/" >}}), and the [`agctl` CLI reference]({{< link-hextra path="/reference/agctl/" >}}).

## 🌟 New features {#v13-new-features}

### New UI

A refreshed UI exposes the new LLM capabilities through LLM, MCP, and traffic-native views, aligned with the new model-based routing model. Configure providers, models, costs, and guardrails and inspect MCP and traffic configuration from one place.

### Standalone LLM enhancements

This release brings a large set of improvements to the standalone LLM experience, expanding first-class support for model-based routing, where a single endpoint such as `/v1/chat/completions` is exposed and the model is specified in the request body.

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2186 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2206 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2180 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2209 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2184 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/1879 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2212 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2105 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2099 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2217 -->

- **Virtual models**: Define a public model name that routes to one or more concrete models using weighted, failover, or conditional (CEL-based) routing, and mark concrete models as `public` or `internal`.
- **Shared providers**: Define a named provider once with shared defaults and reference it from multiple models, with per-model overrides.
- **Model-cost catalog**: Supply a model-cost catalog so the gateway computes real per-request cost, surfaced through CEL, logs, traces, and metrics. Catalogs load from files or inline, and `agctl costs import` can generate one.
- **13 new first-class providers**: Mistral, Hugging Face, Cohere, Groq, Fireworks, DeepSeek, xAI, Together AI, OpenRouter, Cerebras, DeepInfra, Baseten, and Ollama can be selected by name with sensible defaults, and `baseUrl` replaces the older host and path override fields. For more information, see the [LLM providers section]({{< link-hextra path="/llm/providers/" >}}).
- **Custom provider**: Access providers without built-in support directly, rather than approximating them with the `OpenAI` provider and a custom `base_url`. A `providerOverride` tags a custom backend with a known provider name so cost and telemetry attribute correctly.
- **More API endpoints**: Beyond chat completions, the standalone LLM listener now supports the Cohere-compatible Rerank API (`/v2/rerank`), embeddings, token counting, and model listing. For more information, see the [API types section]({{< link-hextra path="/llm/api-types/" >}}).
- **Serve LLM over TLS**: The standalone LLM listener can now serve HTTPS directly.
- **CORS for the local LLM listener**: Configure CORS on the LLM listener, including correct handling of non-matching requests and 404s.
- **Share a port for MCP and LLM**: Serve MCP and LLM traffic on a single shared listener port.

### Guardrails

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2177 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2170 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/1946 -->

- **Shared guardrails**: Define guardrails as a shared top-level resource that applies to all models, merged with per-model guardrails.
- **Streaming guardrails**: Optionally run guardrails on streaming (SSE) and realtime responses.
- **Webhook `failureMode`**: Webhook guardrails support fail-open or fail-closed behavior.

### ExtMCP: MCP-aware external auth and processing

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1842 -->

External authorization and external processing integrations can now make decisions using MCP request context, such as the tool being called and its arguments, rather than only generic HTTP metadata. For more information, see the [MCP guardrail docs]({{< link-hextra path="/mcp/guardrails/">}}).

### External processing enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1787 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2010 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2071 -->

- **Per-phase processing modes**: Control whether headers, body, and trailers are sent to the ext_proc server for each phase, choose how the body is delivered, and optionally allow the ext_proc server to override the mode.
- **`ImmediateResponse` from body phases**: An ext_proc server can now return an `ImmediateResponse` from the request body and response body phases and have it returned to the client.

### Request buffering

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2017 -->

A new buffering policy can accumulate request and response bodies in memory before forwarding, with configurable size limits. For more information, see [Body buffering]({{< link-hextra path="/configuration/traffic-management/buffer/" >}}).

### Authentication and authorization

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2164 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/1876 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2175 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/1844 -->

- **Per-model authorization**: LLM authorization can be configured per model, and `/v1/models` listings are gated by authorization.
- **API key permissive mode**: A new permissive API key mode never rejects requests; valid keys add claims while missing or invalid keys pass through.
- **Pre-routing authorization**: Authorization, including CORS, can run in the pre-routing phase.
- **External auth caching**: External auth supports caching, with a configurable cache key and a TTL that can be a duration or a CEL expression.

### MCP improvements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1831 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2100 -->

- Added Okta as a first-class MCP authentication provider.
- Added resource subscribe and unsubscribe support, and improved resource multiplexing.
- Advertised prompt, resource, and tool list-change capabilities.

### CEL enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2102 -->

- Added route metadata to the CEL context and gRPC status to the response context.
- Added raw JWT bearer token access via `jwt.rawToken`.
- Added URL encode/decode functions, timestamp conversion helpers, and bit operations on bytes.
- Added support for CEL expressions in direct responses and retry conditions.

### Operations and observability

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1784 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/1849 -->

- Added proxy timing measurements, a configuration synchronization metric, and request and connection IDs for troubleshooting.
- Improved distributed trace output, including JSON mode, body snapshots, and effective gateway and route policies.
