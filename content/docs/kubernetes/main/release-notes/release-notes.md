---
title: Release notes
weight: 20
description: What's new, changed, and fixed in each agentgateway on Kubernetes release.
test: skip
---

Review the release notes for agentgateway on Kubernetes.

> [!NOTE]
> For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).

## ✨ Highlights {#v16-highlights}

Version 1.6 provides many updates to existing features, including the following quick highlights. Before you upgrade, review the [breaking changes](#v16-breaking-changes), because several defaults change.

- **[`AgentgatewayModel` is on by default](#v16-llm)**: The model-centric API is no longer experimental, so you can serve LLMs without a Helm flag.
- **[More resilient LLM routing](#v16-llm)**: Failover evicts unhealthy targets automatically, a virtual model with one broken target keeps serving, and a new idle timeout catches backends that stall mid-stream.
- **[Authentication improvements](#v16-security)**: JWT providers are selected by issuer and key ID, `requiredClaims` sets which claims a token must carry, and AWS and Azure backend authentication gain `externalId` and `scopes`.
- **[Session affinity](#v16-traffic)**: Send the requests that share a value, such as a session header, to the same endpoint.

## 🔥 Breaking changes {#v16-breaking-changes}

### Anthropic Messages requests convert to the Responses format {#v16-messages-responses}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3647 -->

Agentgateway now prefers the OpenAI Responses format when it converts Anthropic Messages requests. In 1.5, it preferred Chat Completions. This change applies to these providers:

- `OpenAI`, `Ollama`, `Groq`, `Huggingface`, and `XAI`
- `Azure` for models other than Claude
- `Custom` providers that declare both `Responses` and `Completions`

The Responses conversion drops extended-thinking history. The Chat Completions conversion preserves it.

**Actions to take**: Use the `OpenAI` provider only for the OpenAI API. For other OpenAI-compatible servers, use a `Custom` provider with the formats that the server supports. If the server does not support `/v1/responses`, declare only `Completions`. Also declare only `Completions` if your clients need extended-thinking history.

Use `AGENTGATEWAY_MESSAGES_PREFER_COMPLETIONS=true` only to work around a Responses conversion bug with a provider that supports both formats. Set this environment variable in `spec.env` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. The variable is removed in 1.7. For more information, see [Supported formats]({{< link-hextra path="/integrations/llm/providers/custom/#supported-formats" >}}).

### Built-in model catalog for default request pricing {#v16-built-in-catalog}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3191 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3669 -->

Agentgateway now includes a built-in model cost catalog. Requests to common public models have a cost in logs, traces, metrics, and CEL without extra configuration. In 1.5, you had to configure a catalog to calculate costs. Cost-based CEL expressions, such as rate limits that use `llm.cost`, now apply to these models.

**Actions to take**: Review your cost-based policies and CEL expressions. If you already configure a catalog, you can remove that configuration. To customize rates, add an overlay to the built-in catalog. For more information, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}).

### A `baseURL` with no path sets the base path to `/` {#v16-baseurl-base-path}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3403 -->

`spec.baseURL` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} now always sets the full base path. A URL with no path, such as `https://api.openai.com`, sets the base path to `/`. In 1.5, `Custom` and `Ollama` providers appended `/v1`. Built-in providers such as `OpenAI` forwarded the client's path.

**Actions to take**: Add the provider's API path to every `spec.baseURL` that has no path. For example, change `https://api.openai.com` to `https://api.openai.com/v1`. For Ollama, change `http://ollama.default.svc.cluster.local:11434` to `http://ollama.default.svc.cluster.local:11434/v1`. URLs that already have a path are unaffected. For more information, see [Providers]({{< link-hextra path="/documentation/llm/models/about/#providers" >}}).

## ⚠️ Removed {#v16-removed}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3208 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3520 -->

- **Legacy token counts**: The `AGENTGATEWAY_LEGACY_LLM_USAGE_TOKEN_SEMANTICS` environment variable is removed. In 1.5, it restored the earlier token counts that left out cache tokens. In logs, metrics, and CEL, input and total token counts now always include cache tokens. The token usage that agentgateway returns to clients follows the API that the client calls instead. For more information, see [Other behavior changes](#v16-behavior-changes).
- **Server-side defaults in the CRDs**: The CRD schemas no longer declare default values, such as `action: Allow` or `tracing.protocol: GRPC`. The controller applies the same defaults at runtime, so behavior does not change. However, `kubectl get -o yaml` now shows only the fields that you set. If your GitOps diffs or scripts expect the default values to appear in the stored resource, update them.

## 🔄 Other behavior changes {#v16-behavior-changes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3294 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3253 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3539 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3177 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3599 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3112 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3533 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3462 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3426 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3618 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3221 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3687 -->

- **Policy conflicts**: When two policies with the same specificity set the same field, the oldest policy by `metadata.creationTimestamp` now wins consistently. In 1.5, the winner was not predictable.
- **AI transformation fields**: The `spec.backend.ai.transformations` and `spec.backend.ai.finalTransformations` lists of an {{< reuse "agw-docs/snippets/policy.md" >}} now reject duplicate `field` values. A policy with duplicates fails validation when you next apply it.
- **LLM paths on a listener**: A model router that is attached to a `Gateway` or `ListenerSet` listener serves only the standard LLM paths, and each path must match exactly. To serve the paths under a prefix, attach the models to an `HTTPRoute`. For more information, see [Parent types]({{< link-hextra path="/documentation/llm/models/about/#parent-types" >}}).
- **Backend authentication errors**: When agentgateway cannot get credentials from a provider, such as an OAuth token endpoint, AWS STS, or Azure, the request now fails with `502` instead of `500`. Local failures, such as a static key that cannot be set, return `500` instead of `503`.
- **Backend request timeout**: The `spec.backend.http.requestTimeout` field of an {{< reuse "agw-docs/snippets/policy.md" >}} now also limits the time to read a buffered body. This limit applies to external authorization and CEL expressions that use `response.body`, for example. Streamed bodies are unaffected.
- **Access log level**: Request log records now use `error` when agentgateway records a request error, and `info` otherwise. In 1.5, all request records used `info`.
- **Guardrail results**: The `guardrails` CEL variable now has an entry for every guard that ran, including a new `allow` action. To find interventions only, filter on `action != "allow"`.
- **Failover eviction**: A backend or virtual model with more than one priority group now evicts a failing target by default. A health policy replaces this default. To keep failover, include `spec.backend.health.eviction` in the {{< reuse "agw-docs/snippets/policy.md" >}}. For concrete {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} targets, set `spec.policies.health.eviction`. For more information, see [Model failover]({{< link-hextra path="/documentation/llm/failover/" >}}).
- **Policy service timeouts**: Calls to external services default to a timeout of 2 seconds for gRPC external authorization and 10 seconds for rate limit and external processing services.
- **Streaming guardrails**: Agentgateway now rejects content if a provider guard fails while checking a streamed response or realtime connection. To keep the 1.5 behavior, set `failureMode: FailOpen` on the guard. For example, set it in `spec.backend.ai.promptGuard.response[].bedrockGuardrails` of an {{< reuse "agw-docs/snippets/policy.md" >}}. For more information, see [Provider failures]({{< link-hextra path="/documentation/llm/guardrails/overview/#provider-failures" >}}).
- **Token usage in responses**: The `usage` that agentgateway returns to clients now follows the conventions of the API that the client calls, whichever provider serves the request. Anthropic Messages responses leave cache tokens out of `input_tokens` and report them in `cache_read_input_tokens` and `cache_creation_input_tokens`. OpenAI Chat Completions and Responses include cache tokens in the input and total token counts. For example, a Chat Completions request to an Anthropic or Amazon Bedrock model that writes to the prompt cache now reports those cache tokens in `prompt_tokens`. If a client calculates usage or cost from these fields, review its counts after you upgrade.
- **Deployer ownership**: The controller no longer overwrites an existing resource of the same name that it does not own. It reports an error instead.

## 🌟 New features {#v16-new-features}

### LLM {#v16-llm}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3741 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3492 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3489 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3391 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3320 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3389 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3495 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3408 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3395 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3507 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3496 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3498 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3509 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3514 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3515 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3581 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3618 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3270 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3731 -->

- **Meta provider**: Set `spec.provider: Meta` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} to use the Meta Model API preset. For the backend configuration, see [OpenAI-compatible providers]({{< link-hextra path="/integrations/llm/providers/openai-compatible/" >}}).
- **`AgentgatewayModel` on by default**: The `agentgatewayModels.enabled` Helm value now defaults to `true`. For more information, see [About models]({{< link-hextra path="/documentation/llm/models/about/" >}}).
- **Wildcard models in `/v1/models`**: For an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} with a wildcard `spec.match.model`, `/v1/models` lists matching model IDs from the catalog. For example, `openai/*` expands to IDs such as `openai/gpt-4o`. For more information, see [Verify model discovery]({{< link-hextra path="/documentation/llm/models/serve/#verify-model-discovery" >}}).
- **Skip broken virtual model targets**: A virtual model with one broken target skips that target instead of failing as a whole. For more information, see [Fail over when a model degrades]({{< link-hextra path="/documentation/llm/models/virtual/#fail-over-when-a-model-degrades" >}}).
- **Partially valid backends**: An {{< reuse "agw-docs/snippets/backend.md" >}} with one invalid inline policy is accepted with a `PartiallyValid` status instead of being dropped. For more information, see [Debug]({{< link-hextra path="/documentation/operations/debug/#check-the-gateway-route-and-policy-status" >}}).
- **Response idle timeout**: A response idle timeout ends a response if the backend stops sending body data for the configured time. It does not limit the duration of an active stream. Set `spec.traffic.timeouts.responseIdle` in an {{< reuse "agw-docs/snippets/policy.md" >}}. The [HTTP/1 idle timeout]({{< link-hextra path="/documentation/resiliency/timeouts/idle/" >}}) applies to unused client connections between requests. For more information, see [Timeouts]({{< link-hextra path="/documentation/resiliency/timeouts/about/#configuration-options" >}}).
- **Larger LLM buffer**: LLM requests can now buffer up to 32 MiB by default, up from 2 MiB. The larger buffer supports long-context prompts. To change the limit, set `spec.frontend.http.maxBufferSize` in an {{< reuse "agw-docs/snippets/policy.md" >}}. For more information, see [Buffer limits]({{< link-hextra path="/documentation/traffic-management/buffering/" >}}).
- **Per-page pricing**: To price OCR and document models that bill per processed page, set `rates.perPage` in the model's cost catalog entry. For more information, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}).
- **Bedrock Mantle routing**: The Bedrock provider chooses the Runtime or Mantle endpoint for each model. To set the preference, use `spec.bedrock.endpointPreference` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} or `spec.ai.provider.bedrock.endpointPreference` on an {{< reuse "agw-docs/snippets/backend.md" >}}. For more information, see [Bedrock Mantle]({{< link-hextra path="/integrations/llm/providers/bedrock/#bedrock-mantle" >}}).
- **More accurate Messages conversion**: Conversion between the Messages and OpenAI formats now carries citations, refusals, the `strict` setting of tool schemas, reasoning effort, and images in tool results. A context overflow error from the provider is translated so that Claude Code can compact and retry. For more information, see [Converted replies and errors]({{< link-hextra path="/integrations/llm/providers/custom/#converted-replies-and-errors" >}}).
- **Guardrails**: The `openAIModeration`, `bedrockGuardrails`, and `googleModelArmor` guards now support `failureMode`. Set this field on a guard in `spec.backend.ai.promptGuard` of an {{< reuse "agw-docs/snippets/policy.md" >}}. The built-in credit card pattern now checks the Luhn checksum. For more information, see [Provider failures]({{< link-hextra path="/documentation/llm/guardrails/overview/#provider-failures" >}}).

### Security {#v16-security}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3713 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3611 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3381 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3486 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3449 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3317 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3419 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3540 -->

- **JWT validation**: With several providers in the `spec.traffic.jwtAuthentication` field of an {{< reuse "agw-docs/snippets/policy.md" >}}, agentgateway tries each provider whose `issuer` and JWKS key ID match the token. A provider's `validation.requiredClaims` field sets the claims that a token must carry. Agentgateway also checks the `nbf` (not before) claim to reject tokens that are not yet valid. This check allows 60 seconds of leeway for clock skew. For more information, see [JWT required claims]({{< link-hextra path="/documentation/security/jwt/setup/#jwt-required-claims" >}}).
- **Backend authorization**: Kubernetes policies can now authorize requests after the destination backend is selected. Set `spec.backend.authorization` on an {{< reuse "agw-docs/snippets/policy.md" >}}, or configure authorization inline on an {{< reuse "agw-docs/snippets/backend.md" >}} for the whole backend or an individual AI provider. For more information, see [Authorize requests to a selected backend]({{< link-hextra path="/documentation/security/authorization/#backend-authorization" >}}).
- **Backend authentication**: In the `spec.backend.auth` field of an {{< reuse "agw-docs/snippets/policy.md" >}}, AWS `assumeRole` takes an `externalId`, and Azure authentication takes `scopes`. For more information, see [AWS]({{< link-hextra path="/documentation/security/backend-authn/providers/aws/#assume-an-iam-role" >}}) and [Azure]({{< link-hextra path="/documentation/security/backend-authn/providers/azure/#configure-token-scopes" >}}).
- **CA certificate key**: You can now read the CA bundle from a key other than `ca.crt`, such as one that trust-manager writes. Set `key` in a `caCertificateRefs` entry under `spec.backend.tls` of an {{< reuse "agw-docs/snippets/policy.md" >}}. For more information, see [Read the certificate from another key]({{< link-hextra path="/documentation/security/backendtls/#ca-key" >}}).
- **Network authorization by destination**: Expressions in the `spec.frontend.networkAuthorization` field of an {{< reuse "agw-docs/snippets/policy.md" >}} can match on `destination.address`, `destination.port`, and the TLS SNI hostname in `destination.hostname`. For more information, see [Restrict network access by TLS SNI]({{< link-hextra path="/documentation/security/authorization/#restrict-network-access-by-tls-sni" >}}).

### MCP {#v16-mcp}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3544 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3593 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3197 -->

- **List pagination**: List responses for tools, prompts, and resources carry a `nextCursor`. When an endpoint federates several targets, the client gets one combined cursor that tracks every target. For more information, see [List pagination]({{< link-hextra path="/documentation/mcp/spec-compatibility/#list-pagination" >}}).
- **Request size limit**: An MCP request body that is larger than the buffer limit returns `413`. For more information, see [Buffer limits]({{< link-hextra path="/documentation/traffic-management/buffering/#about-buffer-limits" >}}).
- **Method names in policies**: Agentgateway automatically sets `mcp.methodName` from the request's JSON-RPC method, such as `tools/call`. Route and backend policies can use this CEL variable for rate limits and authorization. For more information, see [MCP rate limits]({{< link-hextra path="/documentation/mcp/rate-limit/#how-tool-calls-map-to-http-requests" >}}).

### Traffic management and operations {#v16-traffic}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3268 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2779 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3351 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3400 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3430 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3319 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3259 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3218 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3421 -->

- **Session affinity**: Session affinity sends related requests to the same endpoint. Set `spec.backend.sessionAffinity` in an {{< reuse "agw-docs/snippets/policy.md" >}}. Its CEL `source` expression provides the value to hash, such as a session header. For more information, see [Session affinity]({{< link-hextra path="/documentation/traffic-management/load-balancing/#session-affinity" >}}).
- **Per-key local rate limits**: Local rate limits can now give each user or API key a separate bucket. Set a CEL `key` in `spec.traffic.rateLimit.local` of an {{< reuse "agw-docs/snippets/policy.md" >}}. For more information, see [Claim-level rate limits]({{< link-hextra path="/documentation/security/rate-limit-http/#claim-level" >}}).
- **Stable ListenerSet ordering**: ListenerSets now have a stable order. They sort by creation time, oldest first, then by namespace and name. For more information, see [Listener precedence]({{< link-hextra path="/documentation/setup/listeners/overview/#listener-precedence" >}}).
- **Telemetry**: OTLP access logs use the `agentgateway.access` instrumentation scope. The request duration metric records failed requests with an `error_type` label.
- **Istio permissions**: Set the `istio.enabled=false` Helm value to drop the Istio permissions from the controller ClusterRole. For more information, see [Istio resource discovery]({{< link-hextra path="/documentation/install/advanced/#istio-discovery" >}}).
- **Gateway name in proxy metrics**: When `monitoring.enabled` is `true`, the Helm chart creates a PodMonitor. The PodMonitor now copies the `gateway.networking.k8s.io/gateway-name` pod label onto proxy metrics. This label lets the Grafana dashboard filter by Gateway. To change the copied labels, set the `monitoring.proxy.podMonitor.podTargetLabels` Helm value.

### OpenTelemetry field names {#v16-otel-attributes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->

You can now opt in to OpenTelemetry field names for stdout access logs. Set `preset: Otel` in `spec.frontend.accessLog` of an {{< reuse "agw-docs/snippets/policy.md" >}}. For more information, see [Use OpenTelemetry field names]({{< link-hextra path="/documentation/observability/access-logs/view/#preset" >}}).

## 🐛 Fixes {#v16-fixes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3703 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3214 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3726 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3699 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3722 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3759 -->

**Traffic management**

- Connections with `maxConnectionDuration` close with up to 10% jitter, which reduces synchronized reconnects at the configured connection age.

**LLM**

- Vertex AI catalog lookups resolve Anthropic model aliases such as `claude-sonnet-4-5-20250929`, `anthropic/claude-sonnet-4-5@20250929`, and `publishers/anthropic/models/claude-sonnet-4-5@20250929`.
- Bedrock Messages conversion keeps prompt-cache markers from dropped unsupported content blocks by moving the cache point to supported content.

**MCP**

- Access-log CEL expressions can now read dynamic metadata that ExtMCP request-phase guardrails return through `mcpGuardrails`, including on resumed stateful MCP sessions. For more information, see [Log MCP guardrail metadata]({{< link-hextra path="/documentation/observability/access-logs/view/#mcp-guardrails" >}}).
- OpenAPI MCP tools return `image/*` responses as MCP image content instead of UTF-8-decoded text.

**Security**

- The controller no longer fails on a JWT authentication policy that sets `jwks.remote.url` without a `backendRef` when the `AGW_BACKEND_REF_GRANT_MODE` environment variable is set to `route-and-policy`.
