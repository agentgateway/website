---
title: Release notes
weight: 20
description: What's new, changed, and fixed in each agentgateway standalone release.
test: skip
---

Review the release notes for agentgateway standalone.

> [!NOTE]
> For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).

## ✨ Highlights {#v16-highlights}

Version 1.6 provides many updates to existing features, including the following quick highlights. Before you upgrade, review the [breaking changes](#v16-breaking-changes), because several defaults change.

- **[Sign-in improvements for the UI and your apps](#v16-security)**: OIDC sessions gain login and logout endpoints, answer `fetch` requests with `401` instead of a redirect, and fit more group claims into the session cookie.
- **[Cost tracking with no configuration](#v16-built-in-catalog)**: A built-in model catalog prices requests to common public models.
- **[More resilient LLM routing](#v16-llm)**: Failover evicts unhealthy targets automatically, and a new idle timeout catches backends that stall mid-stream.
- **[More complete MCP support](#v16-mcp)**: Paginated list responses, server information overrides, and SSE keep-alive for long-lived streams.

## 🔥 Breaking changes {#v16-breaking-changes}

### Anthropic Messages requests convert to the Responses format {#v16-messages-responses}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3647 -->

Agentgateway now prefers the OpenAI Responses format when it converts Anthropic Messages requests. In 1.5, it preferred Chat Completions. This change applies to these providers:

- `openAI`, `ollama`, `groq`, `huggingface`, and `xai`
- `azure` for models other than Claude
- `custom` providers that declare both `responses` and `completions`

The Responses conversion drops extended-thinking history. The Chat Completions conversion preserves it.

**Actions to take**: Use the `openAI` provider only for the OpenAI API. For other OpenAI-compatible servers, use a `custom` provider with the formats that the server supports. If the server does not support `/v1/responses`, declare only `completions`. Also declare only `completions` if your clients need extended-thinking history.

Use `AGENTGATEWAY_MESSAGES_PREFER_COMPLETIONS=true` only to work around a Responses conversion bug with a provider that supports both formats. Set this environment variable on the agentgateway process. The variable is removed in 1.7. For more information, see [Provider format conversion]({{< link-hextra path="/documentation/llm/api-types/messages/#provider-format-conversion" >}}).

### Built-in model catalog for default request pricing {#v16-built-in-catalog}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3191 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3669 -->

Agentgateway now includes a built-in model cost catalog. Requests to common public models have a cost in logs, traces, metrics, and CEL without extra configuration. In 1.5, you had to configure a catalog to calculate costs. USD API key budgets and CEL expressions that use `llm.cost` now apply to these models.

**Actions to take**: Review your USD budgets and cost-based CEL expressions. If you already configure a catalog, you can remove that configuration. To customize rates, add an overlay to the built-in catalog. For more information, see [Configure a model catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/#configure-a-model-catalog" >}}).

### A `baseUrl` with no path sets the base path to `/` {#v16-baseurl-base-path}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3403 -->

`params.baseUrl` now always sets the full base path. A URL with no path, such as `https://api.openai.com`, sets the base path to `/`. In 1.5, `custom` and `ollama` providers appended `/v1`. Built-in providers such as `openAI` forwarded the client's path.

**Actions to take**: Add the provider's API path to every `params.baseUrl` that has no path. For example, change `https://api.openai.com` to `https://api.openai.com/v1`. For Ollama, change `http://localhost:11434` to `http://localhost:11434/v1`. URLs that already have a path are unaffected. The change also does not affect `formats[].path` values or providers that use their default address.

### LLM serving paths must match exactly {#v16-llm-exact-paths}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3539 -->

With the simplified `llm` configuration, agentgateway used to recognize a standard LLM path by its suffix, so a request to `/tenant-a/v1/messages` was handled as a Messages request. A standard path now must match exactly. A request to a prefixed path is forwarded to the provider as passthrough, without format conversion.

**Actions to take**: If your clients call the LLM paths under a base path, set `llm.pathPrefix` to that path, such as `pathPrefix: /tenant-a`. For more information, see [Model routing and aliases]({{< link-hextra path="/documentation/llm/about/#model-routing-and-aliases" >}}).

### The Helm chart requires `oidc.enabled` for OIDC {#v16-helm-oidc}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3596 -->

The standalone Helm chart now sets the `OIDC_COOKIE_SECRET` environment variable only when the new `oidc.enabled` value is `true`. The value defaults to `false`.

**Actions to take**: If you set `oidc.cookieSecretName` to secure the UI or an app with OIDC, also set `oidc.enabled=true` when you upgrade. Otherwise, agentgateway rejects the OIDC configuration and does not start.

## ⚠️ Removed {#v16-removed}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3208 -->

The `AGENTGATEWAY_LEGACY_LLM_USAGE_TOKEN_SEMANTICS` environment variable is removed. In 1.5, it restored the earlier token counts that left out cache tokens. Input and total token counts now always include cache tokens.

## 🔄 Other behavior changes {#v16-behavior-changes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3177 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3599 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3112 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3533 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3462 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3426 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3618 -->

- **Backend authentication errors**: When agentgateway cannot get credentials from a provider, such as an OAuth token endpoint, AWS STS, or Azure, the request now fails with `502` instead of `500`. Local failures, such as a static key that cannot be set, return `500` instead of `503`.
- **Backend request timeout**: The `backendRequestTimeout` field of the `timeout` policy now also limits the time to read a buffered body. This limit applies to external authorization and CEL expressions that use `response.body`, for example. Streamed bodies are unaffected.
- **Access log level**: Request log records now use `error` when agentgateway records a request error, and `info` otherwise. In 1.5, all request records used `info`.
- **Guardrail results**: The `guardrails` CEL variable now has an entry for every guard that ran, including a new `allow` action. To find interventions only, filter on `action != "allow"`.
- **Failover eviction**: A virtual model with more than one priority group now evicts a failing target by default. A `health` policy that you configure replaces this default, so include `eviction` in it to keep failover. For more information, see [Health vs. eviction]({{< link-hextra path="/documentation/llm/virtual-models/#health-vs-eviction" >}}).
- **Policy service timeouts**: Calls to external services default to a timeout of 2 seconds for gRPC external authorization and 10 seconds for rate limit and external processing services.
- **Streaming guardrails**: Agentgateway now rejects content if a provider guard fails while checking a streamed response or realtime connection. To keep the 1.5 behavior, set `failureMode: failOpen` on the guard. For example, set it in `ai.promptGuard.response[].bedrockGuardrails`. For more information, see [Provider failures]({{< link-hextra path="/documentation/llm/prompt-guards/overview/#provider-failures" >}}).

## 🌟 New features {#v16-new-features}

### LLM {#v16-llm}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3310 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3366 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3495 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3408 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3395 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3487 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3507 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3496 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3498 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3509 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3514 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3515 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3581 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3618 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3474 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3270 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3646 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3649 -->

- **Wildcard models in `/v1/models`**: For wildcard names in `llm.models`, `/v1/models` lists matching model IDs from the catalog. For example, `*` for the OpenAI provider expands to IDs such as `gpt-4o`. To list the pattern as in 1.5, set `llm.discovery: disabled`. For more information, see [Wildcard expansion]({{< link-hextra path="/documentation/llm/api-types/models/#wildcard-expansion" >}}).
- **Response idle timeout**: A response idle timeout ends a response if the backend stops sending body data for the configured time. It does not limit the duration of an active stream. Set `responseIdleTimeout` in the `timeout` policy. You can now also set the `timeout` policy in `llm.policies`. For more information, see [Route timeouts]({{< link-hextra path="/documentation/configuration/resiliency/timeouts/#route-timeouts" >}}).
- **Larger LLM buffer**: LLM requests can now buffer up to 32 MiB by default, up from 2 MiB. The larger buffer supports long-context prompts. To change the limit, set `frontendPolicies.http.maxBufferSize`. For more information, see [Body buffering]({{< link-hextra path="/documentation/configuration/traffic-management/buffer/" >}}).
- **Per-page pricing**: To price OCR and document models that bill per processed page, set `rates.perPage` in the model's cost catalog entry. For more information, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/#advanced-catalog-format" >}}).
- **Bedrock Mantle routing**: The Bedrock provider chooses the Runtime or Mantle endpoint for each model. To set the preference, use `params.bedrockEndpointPreference` on an `llm.models` entry, or set it in the UI. For more information, see [Bedrock Mantle]({{< link-hextra path="/integrations/llm/providers/bedrock/#bedrock-mantle" >}}).
- **More accurate Messages conversion**: Conversion between the Messages and OpenAI formats now carries citations, refusals, the `strict` setting of tool schemas, reasoning effort, and images in tool results. A context overflow error from the provider is translated so that Claude Code can compact and retry. For more information, see [Converted replies and errors]({{< link-hextra path="/documentation/llm/api-types/messages/#converted-replies-and-errors" >}}).
- **Guardrails**: Provider guards in `ai.promptGuard` or `llm.policies.guardrails` now support `failureMode`. Webhook guards support `target.policies` to configure the webhook connection. The built-in credit card pattern now checks the Luhn checksum. For more information, see [Provider failures]({{< link-hextra path="/documentation/llm/prompt-guards/overview/#provider-failures" >}}) and the [JEV integration]({{< link-hextra path="/integrations/llm/guardrails/jev/" >}}).

### Security {#v16-security}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3483 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3281 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3502 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3671 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3611 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3486 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3216 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3449 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3317 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3540 -->

- **OIDC sign-in**: An OIDC policy can serve login and logout endpoints. The UI sets both automatically. A `fetch` request without a session now gets `401` instead of a redirect to the identity provider. Session cookies now use compression so that users with many groups can sign in. For more information, see [OIDC]({{< link-hextra path="/documentation/configuration/security/oidc/" >}}).
- **Hashed API keys in the UI**: The UI stores new API keys as hashes by default.
- **JWT validation**: With several JWT providers, agentgateway tries each provider whose `issuer` and JWKS key ID match the token. Agentgateway also checks the `nbf` (not before) claim to reject tokens that are not yet valid. This check allows 60 seconds of leeway for clock skew. MCP authentication no longer requires `audiences`. For more information, see [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn/#jwt-claim-validation" >}}).
- **Backend authentication**: In the `backendAuth` policy or the `auth` field of an `llm.models` entry, AWS `assumeRole` takes an `externalId`, and Azure authentication takes `scopes`. For more information, see [AWS]({{< link-hextra path="/documentation/configuration/security/backend-authn/providers/aws/#assume-a-role" >}}) and [Azure]({{< link-hextra path="/documentation/configuration/security/backend-authn/providers/azure/#configure-token-scopes" >}}).
- **Network authorization by destination**: Rules in `frontendPolicies.networkAuthorization` can match on `destination.address`, `destination.port`, and the TLS SNI hostname in `destination.hostname`. For more information, see [Require TLS SNI]({{< link-hextra path="/documentation/configuration/security/network-authz/#require-tls-sni" >}}).

### MCP {#v16-mcp}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3544 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3601 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3197 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3425 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3393 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3593 -->

- **List pagination**: List responses for tools, prompts, and resources carry a `nextCursor`. When an endpoint federates several targets, the client gets one combined cursor that tracks every target. For more information, see [List pagination]({{< link-hextra path="/documentation/mcp/spec-compatibility/#list-pagination" >}}).
- **MCP fields in CEL**: Access logs can record list results, such as `mcp.toolsList`, and authorization rules can match on `mcp.methodName`. For more information, see [MCP logging fields]({{< link-hextra path="/documentation/mcp/mcp-observability/#mcp-logging-fields" >}}) and [CEL variables]({{< link-hextra path="/documentation/configuration/security/mcp-authz/#cel-variables" >}}).
- **Server information overrides**: An `mcp.server` block replaces the `serverInfo` and instructions that a multiplexed gateway reports. For more information, see [Server information overrides]({{< link-hextra path="/integrations/mcp/servers/virtual/#server-information-overrides" >}}).
- **SSE keep-alive**: `mcp.sseKeepAlive` sends periodic comments on long-lived MCP streams so that idle proxies do not close them. For more information, see [SSE keep-alive]({{< link-hextra path="/documentation/mcp/configuration-modes/#sse-keep-alive" >}}).
- **Request size limit**: An MCP request body that is larger than the buffer limit returns `413`. For more information, see [MCP request body limits]({{< link-hextra path="/integrations/mcp/servers/http/#mcp-request-body-limits" >}}).

### Traffic management and operations {#v16-operations}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3351 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3542 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3334 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3503 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3521 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3430 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3319 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3259 -->

- **Per-key local rate limits**: A `localRateLimit` entry takes a CEL `key` that gives each value, such as a user or API key, its own bucket. For more information, see [Per-key limits]({{< link-hextra path="/documentation/configuration/resiliency/rate-limits/#per-key" >}}).
- **External processing**: With `failureMode: failOpen`, a request that has a body is now forwarded, with its body, when the processing server fails before any body bytes are sent to it. For more information, see [Failure modes]({{< link-hextra path="/documentation/configuration/traffic-management/extproc/#failure-modes" >}}).
- **Graceful drain**: During shutdown, agentgateway stops accepting new connections after `config.connectionMinTerminationDeadline`. It continues to serve open connections until `config.connectionTerminationDeadline`. For more information, see [Shutdown and drain]({{< link-hextra path="/documentation/configuration/static-configuration/#shutdown-drain" >}}).
- **Helm chart scaling**: The standalone chart can create a PodDisruptionBudget and a HorizontalPodAutoscaler. For more information, see [Create a PodDisruptionBudget]({{< link-hextra path="/documentation/setup/install/helm/#helm-pdb" >}}).
- **Telemetry**: OTLP access logs use the `agentgateway.access` instrumentation scope. The request duration metric records failed requests with an `error_type` label. For the metrics, see the [metrics reference]({{< link-hextra path="/documentation/observability/metrics/reference/#llm" >}}).

### OpenTelemetry field names {#v16-otel-attributes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->

You can now opt in to OpenTelemetry field names for stdout access logs. Set `frontendPolicies.accessLog.preset: otel`. For more information, see [Use OpenTelemetry field names]({{< link-hextra path="/documentation/observability/access-logs/view/#preset" >}}).
