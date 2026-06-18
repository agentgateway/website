🎉 Welcome to the 1.3.0 release of the agentgateway project!

This release is a major step forward for LLM, MCP, and agentic traffic. Agentgateway v1.3.0 adds a purpose-built UI, AI cost analysis, virtual models, reusable providers and guardrails, 13 new LLM providers, richer MCP support, and many improvements across traffic policy, TLS, telemetry, and operations.

## Artifacts

**Docker images** are available:
* `cr.agentgateway.dev/agentgateway:v1.3.0`
* `cr.agentgateway.dev/controller:v1.3.0`

**Helm charts** are available:
* `cr.agentgateway.dev/charts/agentgateway:v1.3.0`
* `cr.agentgateway.dev/charts/agentgateway-crds:v1.3.0`

**Binaries** are available below.

## Quick Start

Follow the [Kubernetes](https://agentgateway.dev/docs/kubernetes/latest/quickstart/) or [Standalone](https://agentgateway.dev/docs/standalone/latest/quickstart/) quick start guide to get started.

## 🔥 Breaking changes

### `agctl` commands reorganized under `proxy` and `controller`

The experimental `agctl` CLI now groups its inspection, tracing, and management commands under the `proxy` and `controller` parent commands, and adds commands for log-level management and version information. Update any scripts or automation that call the previous top-level commands.

Kubernetes examples:

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

Standalone examples:

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

The reorganization also introduces the following capabilities:

- `agctl version` prints version information for the `agctl` CLI.
- `agctl proxy log` gets or sets the proxy log level at runtime.
- `agctl controller log` gets or sets the agentgateway controller log level per component at runtime.

For more information, see the Kubernetes docs for [installing `agctl`](https://agentgateway.dev/docs/kubernetes/main/operations/agctl/), [inspecting agentgateway configuration](https://agentgateway.dev/docs/kubernetes/main/operations/inspect-config/), [tracing requests with `agctl`](https://agentgateway.dev/docs/kubernetes/main/operations/trace-requests/), [debug logs](https://agentgateway.dev/docs/kubernetes/main/operations/debug/#debug-logs), and the [`agctl` CLI reference](https://agentgateway.dev/docs/kubernetes/main/reference/agctl/). For standalone mode, see [installing `agctl`](https://agentgateway.dev/docs/standalone/main/operations/agctl/), [inspecting agentgateway configuration](https://agentgateway.dev/docs/standalone/main/operations/inspect-config/), [tracing requests with `agctl`](https://agentgateway.dev/docs/standalone/main/operations/trace-requests/), and the [`agctl` CLI reference](https://agentgateway.dev/docs/standalone/main/reference/agctl/).

## 🌟 New features

### New UI for LLM, MCP, and traffic management

Agentgateway now includes a rebuilt UI organized around three native views:

- **LLM**: Models, providers, policies, guardrails, costs, virtual API keys, and analytics.
- **MCP**: Servers, tools, resources, authentication, and MCP policy configuration.
- **Traffic**: Gateway API traffic configuration and policy management.

The UI includes onboarding for LLM, MCP, and API capabilities, model and provider setup, per-model policies, request and response guardrails, and unified logs for LLM, MCP, and A2A calls. For more information, see the [Kubernetes UI observability docs](https://agentgateway.dev/docs/kubernetes/main/observability/ui/) and the [LLM](https://agentgateway.dev/docs/kubernetes/main/llm/) and [MCP](https://agentgateway.dev/docs/kubernetes/main/mcp/) docs.

### AI cost and token analysis

Agentgateway can now calculate token usage and dollar cost for LLM requests, attribute usage, and surface the data in logs, traces, metrics, `agctl`, and the UI.

Cost and token data can be grouped by model, provider, user, team, and client tool. This makes it possible to analyze spend, export reports, build chargeback workflows, and apply policy decisions such as budgets, alerts, quotas, or cost-sensitive routing at the gateway.

For more information, see [Kubernetes LLM cost tracking](https://agentgateway.dev/docs/kubernetes/main/llm/cost-tracking/), [Standalone LLM spending](https://agentgateway.dev/docs/standalone/main/llm/spending/), and the [`agctl costs` reference](https://agentgateway.dev/docs/kubernetes/main/reference/agctl/agctl-costs/).

### Virtual models

Virtual models let clients send one model name while agentgateway chooses the real backend model at request time. This moves routing policy out of clients and into the gateway.

Supported strategies include:

- **Weighted routing** to split traffic across models for A/B testing, migrations, and cost optimization.
- **Failover routing** to automatically retry fallback models when a primary model fails or is rate-limited.
- **Conditional routing** to select models with CEL expressions based on request attributes such as headers, user tier, or prompt shape.

For more information, see [Standalone virtual models](https://agentgateway.dev/docs/standalone/main/llm/virtual-models/), [Kubernetes LLM load balancing](https://agentgateway.dev/docs/kubernetes/main/llm/load-balancing/), [Kubernetes LLM failover](https://agentgateway.dev/docs/kubernetes/main/llm/failover/), and [Kubernetes LLM content routing](https://agentgateway.dev/docs/kubernetes/main/llm/content-routing/).

### Reusable providers and guardrails

Providers and guardrails can now be defined once and referenced across many models. This simplifies large LLM deployments where many incoming model names share provider configuration, credentials, or policy.

Standalone deployments can also declare shared guardrails as top-level resources instead of repeating guardrail configuration on every route. For more information, see [Standalone guardrails](https://agentgateway.dev/docs/standalone/main/llm/prompt-guards/overview/), [Standalone multi-layer guardrails](https://agentgateway.dev/docs/standalone/main/llm/prompt-guards/multi-layer/), and [Kubernetes guardrails](https://agentgateway.dev/docs/kubernetes/main/llm/guardrails/overview/).

### New and improved LLM providers

Agentgateway adds 13 new first-class LLM providers, including Mistral, Hugging Face, and Cohere, along with expanded custom provider support for providers without built-in integrations. For more information, see the [Standalone LLM provider docs](https://agentgateway.dev/docs/standalone/main/llm/providers/) and [Kubernetes LLM provider docs](https://agentgateway.dev/docs/kubernetes/main/llm/providers/).

Additional LLM gateway improvements include:

- Rerank request and response support across providers.
- Custom LLM providers for InferencePool backends.
- More precise per-model matching, with exact matches preferred.
- Streaming guardrails for streaming requests.
- Webhook guardrail `failureMode` support.
- Per-model LLM authorization.
- Local LLM TLS and CORS support.
- Latency and throughput telemetry attributes on LLM requests.
- Bedrock detect-passthrough support, Application Inference Profile prompt cache support, Anthropic beta-header allowlists, host override support, URL-encoded model IDs, and reasoning-signature replay.
- Anthropic system messages and extra-high thinking support.

### MCP improvements

MCP support now includes Okta as a first-class authentication provider, MCP-aware external auth and external processing, resource subscribe and unsubscribe support, improved multiplexing behavior, and broader protocol compliance fixes.

The UI also includes native MCP policy views for access control, traffic shaping, and mutation policies such as authorization, CORS, JWT, rate limiting, transformations, and external processing. For more information, see the [Kubernetes MCP docs](https://agentgateway.dev/docs/kubernetes/main/mcp/), [Standalone MCP docs](https://agentgateway.dev/docs/standalone/main/mcp/), [MCP authentication](https://agentgateway.dev/docs/kubernetes/main/mcp/auth/), and [MCP guardrails](https://agentgateway.dev/docs/kubernetes/main/mcp/guardrails/).

### Request handling and extensibility

Traffic policies can now buffer request bodies before forwarding, giving policies and extensions access to full request bodies before backend selection. For more information, see [Kubernetes body buffering](https://agentgateway.dev/docs/kubernetes/main/traffic-management/buffer/) and [Standalone body buffering](https://agentgateway.dev/docs/standalone/main/configuration/traffic-management/buffer/).

External processing support is also expanded with richer processing-mode configuration, and external processors can return an immediate response from request-body and response-body phases. For more information, see [Kubernetes external processing](https://agentgateway.dev/docs/kubernetes/main/traffic-management/extproc/) and [Standalone external processing](https://agentgateway.dev/docs/standalone/main/configuration/traffic-management/extproc/).

### Authentication and authorization

Authorization can now run in the pre-routing phase, and external-auth cache TTL can be configured as an expression. This release also includes external-authz caching, expanded credential-location expressions, and scheme derivation from `X-Forwarded-Proto`. For more information, see [Kubernetes external auth](https://agentgateway.dev/docs/kubernetes/main/security/extauth/), [Standalone external auth](https://agentgateway.dev/docs/standalone/main/configuration/security/external-authz/), [Standalone HTTP authorization](https://agentgateway.dev/docs/standalone/main/configuration/security/http-authz/), and [Standalone JWT authentication](https://agentgateway.dev/docs/standalone/main/configuration/security/jwt-authn/).

### TLS, networking, and policy

This release adds dynamic SSL certificates for Kubernetes listener TLS, generalized backend TLS and backend references, a new `BackendReferenceGrantMode`, configurable policy inheritance strategy, and composable AI backend policies. For more information, see [Kubernetes TLS encryption](https://agentgateway.dev/docs/kubernetes/main/install/tls/), [Kubernetes backend TLS](https://agentgateway.dev/docs/kubernetes/main/security/backendtls/), and [Standalone backend TLS](https://agentgateway.dev/docs/standalone/main/configuration/security/backend-tls/).

Additional networking and policy improvements include terminating inbound CONNECT, configurable admin interfaces including Unix Domain Sockets, AWS AssumeRole support, custom AWS service names, and mTLS certificate passthrough with CEL.

### CEL and `agctl`

CEL support is expanded with helpers for URL encode/decode, timestamp conversions, bit operations on bytes, raw JWT token access, gRPC response status, expressions in direct responses, and CEL-based retry conditions. For more information, see the [Standalone CEL reference](https://agentgateway.dev/docs/standalone/main/reference/cel/).

The `agctl` CLI now includes proxy and controller log commands, version reporting with mismatch checks, route groups in config output, and evicted-backend visibility.

### Operations and observability

Agentgateway now exposes proxy timing measurements, a config-synchronization metric, request and connection IDs for troubleshooting, and richer distributed traces with JSON mode, body snapshots, effective gateway and route policies, and raw-output file opening. For more information, see [Kubernetes observability](https://agentgateway.dev/docs/kubernetes/main/observability/), [Kubernetes tracing](https://agentgateway.dev/docs/kubernetes/main/observability/tracing/), [Standalone metrics](https://agentgateway.dev/docs/standalone/main/reference/observability/metrics/), and [Standalone traces](https://agentgateway.dev/docs/standalone/main/reference/observability/traces/).

## 🪲 Notable fixes

- Fixed TCP route precedence.
- Fixed Gateway status handling when no listeners are valid.
- Fixed route-level OIDC cookie handling.
- Fixed capacity-weighted load balancing.
- Fixed backend eviction retries.
- Fixed streaming-completion capture across Bedrock, Messages, and Responses API paths.
- Fixed credential-location expression behavior.
- Fixed scheme handling from `X-Forwarded-Proto`.
- Improved MCP multiplexing and list behavior.
- Improved MCP protocol compliance across tools, prompts, and resources.

## Contributors

Thank you to everyone who contributed code, reviews, documentation, bug reports, and CI improvements for this release, including more than twenty first-time contributors.

Special thanks to the contributors who drove many of the changes in this release:

- @howardjohn
- @stevenctl
- @keithmattix
- @danehans
- @TwilightTechie
- @filintod

See the full contributor list below.
