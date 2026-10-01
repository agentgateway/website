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

Version 1.6 refines the features that you already use rather than adding new ones. Most changes make LLM routing more resilient, sign-in smoother, and MCP more complete. Before you upgrade, review the [breaking changes](#v16-breaking-changes), because several defaults change.

- **[Sign-in improvements for the UI and your apps](#v16-security)**: OIDC sessions gain login and logout endpoints, answer `fetch` requests with `401` instead of a redirect, and fit more group claims into the session cookie.
- **[Cost tracking with no configuration](#v16-built-in-catalog)**: A built-in model catalog prices requests to common public models.
- **[More resilient LLM routing](#v16-llm)**: Failover evicts unhealthy targets automatically, and a new idle timeout catches backends that stall mid-stream.
- **[More complete MCP support](#v16-mcp)**: Paginated list responses, server information overrides, and SSE keep-alive for long-lived streams.

## 🔥 Breaking changes {#v16-breaking-changes}

### Anthropic Messages requests convert to the Responses format first {#v16-messages-responses}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3647 -->

When a provider supports both the OpenAI Responses and Chat Completions formats, agentgateway now converts an Anthropic Messages request to Responses. In 1.5, it converted to Chat Completions. The change applies to the `openAI` and `azure` providers and to a `custom` provider that declares both formats.

**Actions to take**: If an OpenAI-compatible server behind one of these providers, such as a vLLM deployment, does not serve `/v1/responses`, set the `AGENTGATEWAY_MESSAGES_PREFER_COMPLETIONS=true` environment variable to keep the 1.5 order. The variable is removed in 1.7, so also move that backend to a `custom` provider that declares only the `completions` format. For more information, see [Provider format conversion]({{< link-hextra path="/documentation/llm/api-types/messages/#provider-format-conversion" >}}).

### A built-in model catalog prices requests by default {#v16-built-in-catalog}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3191 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3669 -->

Agentgateway now ships with a built-in model cost catalog, so requests to common public models carry a cost in logs, traces, metrics, and CEL without any configuration. In 1.5, cost was computed only when you configured a catalog. As a result, USD API key budgets and CEL expressions on `llm.cost` start to apply to those models.

When you configure your own catalogs, the proxy uses only the newest base catalog, which is a catalog with a `metadata.generatedAt` timestamp. An imported catalog that is older than the built-in catalog is ignored without a warning.

**Actions to take**: Review your USD budgets and cost-based CEL expressions. After you upgrade, run `agctl catalog import` again. For a catalog of your own rates, remove the `metadata` field so that the catalog applies as an overlay. For more information, see [Configure a model catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/#configure-a-model-catalog" >}}).

### Traces and OTLP access logs use OpenTelemetry attribute names {#v16-otel-attributes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->

Trace spans and access logs that you export over OTLP now name the built-in HTTP attributes by the [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/http/http-spans/). The stdout access log keeps the 1.5 names unless you set `preset: otel` on the access log policy.

| 1.5.x | 1.6.x |
| --- | --- |
| `src.addr` | `client.address` |
| `http.method` | `http.request.method` |
| `http.host` | `server.address` |
| `http.path` | `url.path`, with the query string in `url.query` |
| `http.version` | `network.protocol.version`, such as `1.1` |
| `http.status` | `http.response.status_code` |

**Actions to take**: Update the dashboards, trace queries, alerts, and OTLP field filters that reference the old names. For the stdout preset, see [Use OpenTelemetry field names]({{< link-hextra path="/documentation/observability/access-logs/view/#preset" >}}).

### A `baseUrl` with no path sets the base path to `/` {#v16-baseurl-base-path}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3403 -->

`params.baseUrl` now always sets the full base path. A URL with no path, such as `https://api.openai.com`, sets the base path to `/`. In 1.5, a `custom` or `ollama` provider appended a hardcoded `/v1` instead, and a built-in provider such as `openAI` forwarded the path that the client sent.

**Actions to take**: Add the path that the provider serves its API under to every `params.baseUrl`, such as `https://api.openai.com/v1` or `http://localhost:11434/v1` for Ollama. A URL that already has a path, a `formats[].path` value, and a provider that uses its default address are unaffected.

### LLM serving paths must match exactly {#v16-llm-exact-paths}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3539 -->

With the simplified `llm` configuration, agentgateway used to recognize a standard LLM path by its suffix, so a request to `/tenant-a/v1/messages` was handled as a Messages request. A standard path now must match exactly. A request to a prefixed path is forwarded to the provider as passthrough, without format conversion.

**Actions to take**: If your clients call the LLM paths under a base path, set `llm.pathPrefix` to that path, such as `pathPrefix: /tenant-a`. For more information, see [Model routing and aliases]({{< link-hextra path="/documentation/llm/about/#model-routing-and-aliases" >}}).

### `agctl catalog import` merges sources and tags Bedrock models {#v16-catalog-import}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3275 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3187 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3481 -->

The `--source` flag now takes a comma-separated list of sources that merge in order, and the default changes from `models.dev` to `models.dev,aws-bedrock-mantle`. Rates are unchanged. However, a default import now tags each Amazon Bedrock model with the endpoint that serves it, `runtime` or `mantle`, and with the request formats that Mantle accepts. The tags change routing only for models that only Mantle serves, other than `anthropic.claude*` models.

**Actions to take**: If you route to a Mantle-only Bedrock model, regenerate your catalog and check the model's `tags` against the request formats that your clients send. To keep the 1.5 output, set `--source models.dev`. For more information, see the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference and [Bedrock Mantle]({{< link-hextra path="/integrations/llm/providers/bedrock/#bedrock-mantle" >}}).

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
- **Backend request timeout**: `backendRequestTimeout` now also limits how long agentgateway reads a body that it buffers, such as for external authorization or a CEL expression on `response.body`. Streamed bodies are unaffected.
- **Access log level**: A request log record now has the `warn` level for a `4xx` response and `error` for a `5xx` response or a failed request. In 1.5, every record had the `info` level.
- **Guardrail results**: The `guardrails` CEL variable now has an entry for every guard that ran, including a new `allow` action. To find interventions only, filter on `action != "allow"`.
- **Failover eviction**: A virtual model with more than one priority group now evicts a failing target by default. A `health` policy that you configure replaces this default, so include `eviction` in it to keep failover. For more information, see [Health vs. eviction]({{< link-hextra path="/documentation/llm/virtual-models/#health-vs-eviction" >}}).
- **Policy service timeouts**: Calls to external services default to a timeout of 2 seconds for gRPC external authorization and 10 seconds for rate limit and external processing services.
- **Streaming guardrails**: When a provider guard such as `openAIModeration` fails on a streaming response or a realtime connection, the content is now rejected instead of passed through. To keep the 1.5 behavior, set `failureMode: failOpen`.

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

- **Response idle timeout**: `responseIdleTimeout` ends a response when the backend sends no body data for the configured time, without capping how long a healthy stream runs. The timeout policy is also available on the simplified `llm` section. For more information, see [Route timeouts]({{< link-hextra path="/documentation/configuration/resiliency/timeouts/#route-timeouts" >}}).
- **Larger LLM buffer**: Requests that enter LLM processing can buffer up to 32 MiB by default, up from 2 MiB, to fit long-context prompts. To change the limit, set `frontendPolicies.http.maxBufferSize`. For more information, see [Body buffering]({{< link-hextra path="/documentation/configuration/traffic-management/buffer/" >}}).
- **Per-page pricing**: A cost catalog entry can set `rates.perPage` to price OCR and document models that bill by processed page. For more information, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/#advanced-catalog-format" >}}).
- **Bedrock Mantle routing**: The Bedrock provider chooses the Runtime or Mantle endpoint for each model with `bedrockEndpointPreference`, and the UI can set it. A Bedrock provider with an inline guardrail always uses Runtime. For more information, see [Bedrock Mantle]({{< link-hextra path="/integrations/llm/providers/bedrock/#bedrock-mantle" >}}).
- **More accurate Messages conversion**: Conversion between the Messages and OpenAI formats now carries citations, refusals, the `strict` setting of tool schemas, reasoning effort, and images in tool results. A context overflow error from the provider is translated so that Claude Code can compact and retry. For more information, see [Converted replies and errors]({{< link-hextra path="/documentation/llm/api-types/messages/#converted-replies-and-errors" >}}).
- **Guardrails**: Provider guards take a `failureMode` setting, webhook guards take `policies` for their target, and the built-in credit card pattern checks the Luhn checksum. For more information, see [Provider failures]({{< link-hextra path="/documentation/llm/prompt-guards/overview/#provider-failures" >}}) and the [JEV integration]({{< link-hextra path="/integrations/llm/guardrails/jev/" >}}).

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

- **OIDC sign-in**: An OIDC policy can serve a login endpoint and a logout endpoint, and the UI sets both automatically. A `fetch` request without a session now gets `401` instead of a redirect to the identity provider, and the session cookie is compressed so that users with many groups can sign in. For more information, see [OIDC]({{< link-hextra path="/documentation/configuration/security/oidc/" >}}).
- **Hashed API keys in the UI**: The UI stores new API keys as hashes by default.
- **JWT validation**: With several JWT providers, agentgateway tries each provider whose `issuer` and JWKS key ID match the token. Tokens are checked for the `nbf` claim, and MCP authentication no longer requires `audiences`. For more information, see [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn/#jwt-claim-validation" >}}).
- **Backend authentication**: AWS `assumeRole` takes an `externalId`, and Azure authentication takes `scopes`. For more information, see [AWS]({{< link-hextra path="/documentation/configuration/security/backend-authn/providers/aws/#assume-a-role" >}}) and [Azure]({{< link-hextra path="/documentation/configuration/security/backend-authn/providers/azure/#configure-token-scopes" >}}).
- **Network authorization by destination**: Network authorization rules can match on `destination.address`, `destination.port`, and the TLS SNI hostname in `destination.hostname`. For more information, see [Require TLS SNI]({{< link-hextra path="/documentation/configuration/security/network-authz/#require-tls-sni" >}}).

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
- **SSE keep-alive**: `sseKeepAlive` sends periodic comments on long-lived MCP streams so that idle proxies do not close them. For more information, see [SSE keep-alive]({{< link-hextra path="/documentation/mcp/configuration-modes/#sse-keep-alive" >}}).
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
- **Graceful drain**: During shutdown, agentgateway stops accepting connections after `shutdown.min` and keeps serving open connections until `shutdown.max`. For more information, see [Shutdown and drain]({{< link-hextra path="/documentation/configuration/static-configuration/#shutdown-drain" >}}).
- **Helm chart scaling**: The standalone chart can create a PodDisruptionBudget and a HorizontalPodAutoscaler. For more information, see [Create a PodDisruptionBudget]({{< link-hextra path="/documentation/setup/install/helm/#helm-pdb" >}}).
- **Telemetry**: OTLP access logs use the `agentgateway.access` instrumentation scope, and the request duration metric records failed requests with an `error_type` label. A new guide covers [Datadog]({{< link-hextra path="/integrations/llm/observability/datadog/" >}}). For the metrics, see the [metrics reference]({{< link-hextra path="/documentation/observability/metrics/reference/#llm" >}}).
