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

Version 1.6 refines the features that you already use rather than adding new ones. Most changes make LLM routing more resilient and authentication more flexible. Before you upgrade, review the [breaking changes](#v16-breaking-changes), because several defaults change.

- **[`AgentgatewayModel` is on by default](#v16-llm)**: The model-centric API is no longer experimental, so you can serve LLMs without a Helm flag.
- **[More resilient LLM routing](#v16-llm)**: Failover evicts unhealthy targets automatically, a virtual model with one broken target keeps serving, and a new idle timeout catches backends that stall mid-stream.
- **[Authentication improvements](#v16-security)**: JWT providers are selected by issuer and key ID, `requiredClaims` sets which claims a token must carry, and AWS and Azure backend authentication gain `externalId` and `scopes`.
- **[Session affinity](#v16-traffic)**: Send the requests that share a value, such as a session header, to the same endpoint.

## 🔥 Breaking changes {#v16-breaking-changes}

### Anthropic Messages requests convert to the Responses format first {#v16-messages-responses}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3647 -->

When a provider supports both the OpenAI Responses and Chat Completions formats, agentgateway now converts an Anthropic Messages request to Responses. In 1.5, it converted to Chat Completions. The change applies to the `OpenAI` provider, to the `Azure` provider for models that are not Claude models, and to a `Custom` provider that declares both formats. The Responses conversion drops extended-thinking history, which the Completions conversion carries.

**Actions to take**: Some OpenAI-compatible servers, such as vLLM deployments, do not serve `/v1/responses`. If your server does not, or if your clients rely on thinking history, set the `AGENTGATEWAY_MESSAGES_PREFER_COMPLETIONS=true` environment variable in the `spec.env` field of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. The variable is removed in 1.7, so also move such a backend to a `Custom` provider that declares only the `Completions` format. For more information, see [Supported formats]({{< link-hextra path="/integrations/llm/providers/custom/#supported-formats" >}}).

### A built-in model catalog prices requests by default {#v16-built-in-catalog}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3191 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3669 -->

Agentgateway now ships with a built-in model cost catalog, so requests to common public models carry a cost in logs, traces, metrics, and CEL without any configuration. In 1.5, cost was computed only when you configured a catalog. As a result, CEL expressions on `llm.cost`, such as cost-based rate limits, start to apply to those models.

When you configure your own catalogs, the proxy uses only the newest base catalog, which is a catalog with a `metadata.generatedAt` timestamp. An imported catalog that is older than the built-in catalog is ignored without a warning.

**Actions to take**: Review your cost-based policies and CEL expressions. After you upgrade, run `agctl catalog import` again. For a catalog of your own rates, remove the `metadata` field so that the catalog applies as an overlay. For more information, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}).

### Traces and OTLP access logs use OpenTelemetry attribute names {#v16-otel-attributes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->

Trace spans and access logs that you export over OTLP now name the built-in HTTP attributes by the [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/http/http-spans/). The stdout access log keeps the 1.5 names unless you set `preset: Otel` on the frontend access log policy.

| 1.5.x | 1.6.x |
| --- | --- |
| `src.addr` | `client.address` |
| `http.method` | `http.request.method` |
| `http.host` | `server.address` |
| `http.path` | `url.path`, with the query string in `url.query` |
| `http.version` | `network.protocol.version`, such as `1.1` |
| `http.status` | `http.response.status_code` |

**Actions to take**: Update the dashboards, trace queries, alerts, and OTLP field filters that reference the old names. For the stdout preset, see [Use OpenTelemetry field names]({{< link-hextra path="/documentation/observability/access-logs/view/#preset" >}}).

### A `baseURL` with no path sets the base path to `/` {#v16-baseurl-base-path}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3403 -->

`spec.baseURL` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} now always sets the full base path. A URL with no path, such as `https://api.openai.com`, sets the base path to `/`. In 1.5, a `Custom` or `Ollama` provider appended a hardcoded `/v1` instead, and a built-in provider such as `OpenAI` forwarded the path that the client sent.

**Actions to take**: Add the path that the provider serves its API under to every `spec.baseURL`, such as `https://api.openai.com/v1`. Check your `Ollama` models first, because `Ollama` requires `spec.baseURL`, so an address such as `http://ollama.default.svc.cluster.local:11434` becomes `http://ollama.default.svc.cluster.local:11434/v1`. A URL that already has a path is unaffected. For more information, see [Providers]({{< link-hextra path="/documentation/llm/models/about/#providers" >}}).

### `agctl catalog import` merges sources and tags Bedrock models {#v16-catalog-import}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3275 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3187 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3481 -->

The `--source` flag now takes a comma-separated list of sources that merge in order, and the default changes from `models.dev` to `models.dev,aws-bedrock-mantle`. Rates are unchanged. However, a default import now tags each Amazon Bedrock model with the endpoint that serves it, `runtime` or `mantle`, and with the request formats that Mantle accepts. The tags change routing only for models that only Mantle serves, other than `anthropic.claude*` models.

**Actions to take**: If you route to a Mantle-only Bedrock model, regenerate your catalog and check the model's `tags` against the request formats that your clients send. To keep the 1.5 output, set `--source models.dev`. For more information, see the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference and [Bedrock Mantle]({{< link-hextra path="/integrations/llm/providers/bedrock/#bedrock-mantle" >}}).

## ⚠️ Removed {#v16-removed}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3208 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3520 -->

- **Legacy token counts**: The `AGENTGATEWAY_LEGACY_LLM_USAGE_TOKEN_SEMANTICS` environment variable is removed. In 1.5, it restored the earlier token counts that left out cache tokens. Input and total token counts now always include cache tokens.
- **Server-side defaults in the CRDs**: The CRD schemas no longer declare default values, such as `action: Allow` or `tracing.protocol: GRPC`. The controller applies the same defaults at runtime, so behavior does not change. However, `kubectl get -o yaml` no longer shows fields that you did not set, so GitOps diffs and scripts that read those fields change.

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

- **Policy conflicts**: When two policies with the same specificity set the same field, the oldest policy by `creationTimestamp` now wins consistently. In 1.5, the winner was not predictable.
- **AI transformation fields**: The `transformations` and `finalTransformations` lists of an AI policy reject duplicate `field` values, so a policy with duplicates fails validation on its next apply.
- **LLM paths on a listener**: A model router that is attached to a `Gateway` or `ListenerSet` listener serves only the standard LLM paths, and each path must match exactly. To serve the paths under a prefix, attach the models to an `HTTPRoute`. For more information, see [Parent types]({{< link-hextra path="/documentation/llm/models/about/#parent-types" >}}).
- **Backend authentication errors**: When agentgateway cannot get credentials from a provider, such as an OAuth token endpoint, AWS STS, or Azure, the request now fails with `502` instead of `500`. Local failures, such as a static key that cannot be set, return `500` instead of `503`.
- **Backend request timeout**: `backend.http.requestTimeout` now also limits how long agentgateway reads a body that it buffers, such as for external authorization or a CEL expression on `response.body`. Streamed bodies are unaffected.
- **Access log level**: A request log record now has the `warn` level for a `4xx` response and `error` for a `5xx` response or a failed request. In 1.5, every record had the `info` level.
- **Guardrail results**: The `guardrails` CEL variable now has an entry for every guard that ran, including a new `allow` action. To find interventions only, filter on `action != "allow"`.
- **Failover eviction**: A backend or virtual model with more than one priority group now evicts a failing target by default. A health policy that you attach replaces this default, so include `eviction` in it to keep failover. For more information, see [Model failover]({{< link-hextra path="/documentation/llm/failover/" >}}).
- **Policy service timeouts**: Calls to external services default to a timeout of 2 seconds for gRPC external authorization and 10 seconds for rate limit and external processing services.
- **Streaming guardrails**: When a provider guard such as `openAIModeration` fails on a streaming response or a realtime connection, the content is now rejected instead of passed through. To keep the 1.5 behavior, set `failureMode: FailOpen`.
- **Deployer ownership**: The controller no longer overwrites an existing resource of the same name that it does not own. It reports an error instead.

## 🌟 New features {#v16-new-features}

### LLM {#v16-llm}

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

- **`AgentgatewayModel` on by default**: The `agentgatewayModels.enabled` Helm value now defaults to `true`. Models also attach to the right listener when an `HTTPRoute` names a `sectionName`, and they no longer overwrite the default routes of a listener. For more information, see [About models]({{< link-hextra path="/documentation/llm/models/about/" >}}).
- **Degraded virtual models and backends**: A virtual model with one broken target skips that target instead of failing as a whole. A backend with one invalid inline policy is accepted with a `PartiallyValid` status instead of being dropped. For more information, see [Fail over when a model degrades]({{< link-hextra path="/documentation/llm/models/virtual/#fail-over-when-a-model-degrades" >}}) and [Debug]({{< link-hextra path="/documentation/operations/debug/#check-the-gateway-route-and-policy-status" >}}).
- **Response idle timeout**: `traffic.timeouts.responseIdle` ends a response when the backend sends no body data for the configured time, without capping how long a healthy stream runs. For more information, see [Timeouts]({{< link-hextra path="/documentation/resiliency/timeouts/about/#configuration-options" >}}).
- **Larger LLM buffer**: Requests that are routed to an LLM backend can buffer up to 32 MiB by default, up from 2 MiB, to fit long-context prompts. For more information, see [Buffer limits]({{< link-hextra path="/documentation/traffic-management/buffering/" >}}).
- **Per-page pricing**: A cost catalog entry can set `rates.perPage` to price OCR and document models that bill by processed page. For more information, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}).
- **Bedrock Mantle routing**: The Bedrock provider chooses the Runtime or Mantle endpoint for each model with `endpointPreference`. A Bedrock provider with an inline guardrail must use Runtime. For more information, see [Bedrock Mantle]({{< link-hextra path="/integrations/llm/providers/bedrock/#bedrock-mantle" >}}).
- **More accurate Messages conversion**: Conversion between the Messages and OpenAI formats now carries citations, refusals, the `strict` setting of tool schemas, reasoning effort, and images in tool results. A context overflow error from the provider is translated so that Claude Code can compact and retry. For more information, see [Converted replies and errors]({{< link-hextra path="/integrations/llm/providers/custom/#converted-replies-and-errors" >}}).
- **Guardrails**: The `openAIModeration`, `bedrockGuardrails`, and `googleModelArmor` guards take a `failureMode` setting, and the built-in credit card pattern checks the Luhn checksum. For more information, see [Provider failures]({{< link-hextra path="/documentation/llm/guardrails/overview/#provider-failures" >}}).

### Security {#v16-security}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3611 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3381 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3486 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3449 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3317 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3419 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3540 -->

- **JWT validation**: With several JWT providers, agentgateway tries each provider whose `issuer` and JWKS key ID match the token. `validation.requiredClaims` sets the claims that a token must carry, and tokens are checked for the `nbf` claim. For more information, see [JWT required claims]({{< link-hextra path="/documentation/security/jwt/setup/#jwt-required-claims" >}}).
- **Backend authentication**: AWS `assumeRole` takes an `externalId`, and Azure authentication takes `scopes`. For more information, see [AWS]({{< link-hextra path="/documentation/security/backend-authn/providers/aws/#assume-an-iam-role" >}}) and [Azure]({{< link-hextra path="/documentation/security/backend-authn/providers/azure/#configure-token-scopes" >}}).
- **CA certificate key**: A `caCertificateRefs` entry takes a `key` field to read the CA bundle from a key other than `ca.crt`, such as a key that trust-manager writes. For more information, see [Read the certificate from another key]({{< link-hextra path="/documentation/security/backendtls/#ca-key" >}}).
- **Network authorization by destination**: `spec.frontend.networkAuthorization` expressions can match on `destination.address`, `destination.port`, and the TLS SNI hostname in `destination.hostname`. For more information, see [Restrict network access by TLS SNI]({{< link-hextra path="/documentation/security/authorization/#restrict-network-access-by-tls-sni" >}}).

### MCP {#v16-mcp}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3544 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3593 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3197 -->

- **List pagination**: List responses for tools, prompts, and resources carry a `nextCursor`. When an endpoint federates several targets, the client gets one combined cursor that tracks every target. For more information, see [List pagination]({{< link-hextra path="/documentation/mcp/spec-compatibility/#list-pagination" >}}).
- **Request size limit**: An MCP request body that is larger than the buffer limit returns `413`. For more information, see [Buffer limits]({{< link-hextra path="/documentation/traffic-management/buffering/#about-buffer-limits" >}}).
- **Method names in policies**: `mcp.methodName` is set when policies are evaluated, so rate limits and authorization rules can match on the MCP method. For more information, see [MCP rate limits]({{< link-hextra path="/documentation/mcp/rate-limit/#how-tool-calls-map-to-http-requests" >}}).

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

- **Session affinity**: The `sessionAffinity` backend policy hashes a CEL `source` value, such as a session header, to pick the same endpoint for related requests. For more information, see [Session affinity]({{< link-hextra path="/documentation/traffic-management/load-balancing/#session-affinity" >}}).
- **Per-key local rate limits**: A local rate limit takes a CEL `key` that gives each value, such as a user or API key, its own bucket. For more information, see [Claim-level rate limits]({{< link-hextra path="/documentation/security/rate-limit-http/#claim-level" >}}).
- **Stable ListenerSet ordering**: ListenerSets are ordered by creation time, oldest first, and then by namespace and name, so listener precedence is stable. For more information, see [Listener precedence]({{< link-hextra path="/documentation/setup/listeners/overview/#listener-precedence" >}}).
- **Telemetry**: Set `preset: Otel` to give the stdout access log OpenTelemetry field names. OTLP access logs use the `agentgateway.access` instrumentation scope, and the request duration metric records failed requests with an `error_type` label. A new guide covers [Datadog]({{< link-hextra path="/integrations/llm/observability/datadog/" >}}). For more information, see [Use OpenTelemetry field names]({{< link-hextra path="/documentation/observability/access-logs/view/#preset" >}}).
- **Helm chart**: Set `istio.enabled=false` to drop the Istio permissions from the controller ClusterRole, and the PodMonitor now copies the gateway name label for the Grafana dashboard. For more information, see [Istio resource discovery]({{< link-hextra path="/documentation/install/advanced/#istio-discovery" >}}).
