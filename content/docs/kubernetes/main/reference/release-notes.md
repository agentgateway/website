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

Version 1.6 brings the session affinity and access log field sets of the proxy to the Kubernetes API, and adds support for an upstream Gateway API backend resource.

- **[Session affinity](#v16-session-affinity)**: Send the requests that share a value, such as a session header, to the same endpoint.
- **[OpenTelemetry access log field names](#v16-access-log-preset)**: Rename the built-in HTTP fields in the stdout access log to their semantic convention equivalents.
- **[Experimental `XBackend` support](#v16-xbackend)**: Route to a destination that is declared in the upstream Gateway API `XBackend` resource.

## 🔥 Breaking changes {#v16-breaking-changes}

### `agctl catalog import` reads from the `github` source by default

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3275 -->

The `agctl catalog import` command used to accept only one pricing source, `models.dev`, which was also its default. The command now accepts a second source, `github`, and defaults to it. The `github` source is the curated model catalog that the agentgateway project publishes at [agentgateway.dev/model-catalog](https://agentgateway.dev/model-catalog).

| Flag | 1.5.x | 1.6.x |
| --- | --- | --- |
| `--source` omitted | Imports from `models.dev` | Imports from `github` |
| `--source models.dev` | Imports from `models.dev` | Unchanged |
| `--source github` | Rejected as an unsupported source | Imports from `agentgateway.dev/model-catalog` |

The catalog file format does not change, so a catalog that you generated earlier still loads. The two sources can price a model differently, and the `github` source covers the models that the agentgateway project tracks rather than everything that models.dev lists.

**Actions to take**: If you regenerate your catalog on a schedule and you want to keep importing from models.dev, add `--source models.dev` to the command. Otherwise, regenerate the catalog and compare the rates for the models that you care about before you load the new file, because a rate change alters the costs that appear in logs, traces, metrics, and any CEL policy that reads `llm.cost`. For the flags, see the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference.

## 🌟 New features {#v16-new-features}

### Traffic management {#v16-features-traffic}

#### Session affinity {#v16-session-affinity}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3268 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2779 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2825 -->

The `sessionAffinity` backend policy is now part of the Kubernetes API. Set it in `spec.policies` on an {{< reuse "agw-docs/snippets/backend.md" >}}, or in `spec.backend` on an {{< reuse "agw-docs/snippets/policy.md" >}}. A `source` CEL expression selects an affinity value, which agentgateway hashes and maps to an endpoint by weighted rendezvous hashing, so every proxy replica independently picks the same endpoint without sharing state.

Affinity is best-effort rather than session persistence. Agentgateway recomputes the mapping for each request, so a change to the set of healthy endpoints remaps some values, and a request that produces no usable value falls back to normal load balancing. On an AI backend, the policy applies across the provider groups of the backend and must target the whole backend rather than an individual provider.

For the fields, the fallback behavior, common expressions, and examples, see [Session affinity]({{< link-hextra path="/traffic-management/load-balancing/#session-affinity" >}}).

#### Experimental `XBackend` support {#v16-xbackend}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2634 -->

The controller can now watch the `XBackend` resource from the experimental channel of the Gateway API, in the `gateway.networking.x-k8s.io` API group, and translate it into an agentgateway backend. Use it to declare an external destination, such as a hostname, port, protocol, and backend TLS settings, in an upstream resource instead of an {{< reuse "agw-docs/snippets/backend.md" >}}. The controller also reports status on the resource.

Support is off by default and requires the experimental Gateway API CRDs. To turn it on, set `xBackend.enabled` to `true` in the Helm values of the `agentgateway` chart. For the value, see the [Helm reference]({{< link-hextra path="/reference/helm/agentgateway/" >}}).

### Operations {#v16-features-operations}

#### OpenTelemetry field names for stdout access logs {#v16-access-log-preset}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->

The stdout access log uses short, human-oriented field names, such as `http.path`. A new `preset` field on the frontend access log policy selects a built-in field set instead. Set `preset: Otel` to rename the built-in HTTP fields to their [OpenTelemetry semantic convention](https://opentelemetry.io/docs/specs/semconv/http/http-spans/) equivalents, such as `url.path`, and to emit `network.protocol.version` as `1.1` rather than `HTTP/1.1`. The preset also adds `url.scheme`, and it adds `server.port` and `url.query` when the request supplies them.

Only the built-in HTTP field set is renamed. Fields that you add with the `attributes` field keep the names that you give them, and an OTLP export is unaffected, because it already uses semantic convention attribute names.

For the field rename table and an example, see [Use OpenTelemetry field names]({{< link-hextra path="/observability/access-logs/view/#preset" >}}).

<!-- TODO 1.6 relnotes: the v1.5 sections below are the copy that the version
     rotation left behind in the main tree. The identical copy that belongs to
     1.5 lives in content/docs/kubernetes/latest/reference/release-notes.md.
     Remove everything from here down when the 1.6 notes are drafted in full,
     the same way that commit e86e8d23 replaced the v1.3 sections with v1.4. -->

## ✨ Highlights {#v15-highlights}

Version 1.5 focuses on native provider API surfaces, outbound traffic, and tighter cluster permissions.

- **[Inline URLs for policy backends](#v15-inline-urls)**: Point a policy at an external service by URL, without creating an intermediate Kubernetes object.
- **[Native Gemini inbound API](#v15-gemini-inbound)**: Clients that are built on the Gemini and Vertex AI SDKs can call agentgateway in Gemini's native wire format.
- **[Anthropic Messages to OpenAI Responses conversion](#v15-anthropic-responses)**: Send a client that speaks the Anthropic Messages API to a provider that advertises only the Responses format.
- **[Egress proxying, TCP backends, and CONNECT tunneling](#v15-egress)**: Run agentgateway as an egress proxy for agent workloads.
- **[Namespace-scoped write permissions](#v15-rbac)**: Scope the controller's write access to the namespaces that hold your gateways.

## 🔥 Breaking changes {#v15-breaking-changes}

### LLM input and total token counts include cache tokens

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2880 -->

LLM providers disagree about whether the input token count in a response includes the tokens that the provider read from or wrote to its prompt cache. Anthropic and Amazon Bedrock exclude cached tokens. OpenAI, Azure OpenAI, and Google Gemini include them. Agentgateway used to pass each provider's number through unchanged, so the same prompt produced a different count depending on which provider served it. Agentgateway now normalizes the counts so that they mean the same thing for every provider.

- `llm.inputTokens` is the total input count, including cache-read and cache-creation tokens.
- `llm.totalTokens` is the normalized input count plus the output count.
- `llm.providerInputTokens` and `llm.providerTotalTokens` are new fields that report the counts exactly as the provider sent them.

The `llm.cachedInputTokens` and `llm.cacheCreationInputTokens` fields do not change, and both are now always a subset of `llm.inputTokens`. Only the providers that previously excluded cached tokens report different values. Those providers are Anthropic, Amazon Bedrock, Anthropic models served through Vertex AI or GitHub Copilot, and custom providers that use the `messages` or `anthropicTokenCount` format. Cost tracking does not change, because the model cost catalog already priced cached tokens separately.

**Actions to take**: The normalized counts reach every feature that reads a token count, including access logs, spans, metrics, token-based rate limits, and CEL expressions. To read the provider's unmodified value instead, use `llm.providerInputTokens` or `llm.providerTotalTokens`. Review each token-based rate limit that you sized against a provider that excluded cached tokens, because requests now consume the limit sooner. Annotate the upgrade in any dashboard that trends input tokens.

To restore the previous behavior while you migrate, set the `AGENTGATEWAY_LEGACY_LLM_USAGE_TOKEN_SEMANTICS` environment variable to `true` in `spec.env` on an `AgentgatewayParameters` resource. Agentgateway plans to remove this variable after version 1.5, so treat it as a short-term migration aid.

For each token field and when to read it, see [Token usage fields]({{< link-hextra path="/llm/observability/#token-usage-fields" >}}).

### JWT validation requires the `iss` claim, and `aud` when you configure audiences

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2993 -->

Agentgateway used to compare a JWT policy's `issuer` and `audiences` settings against the token's `iss` and `aud` claims only when the token contained them. A token that omitted a claim therefore passed validation. Agentgateway now requires the claim whenever the corresponding setting exists.

| Policy setting | 1.4.x and earlier | 1.5.x |
| --- | --- | --- |
| `issuer` | The `iss` claim is matched if the token has one | The `iss` claim is required and must match |
| `audiences` set to a non-empty list | The `aud` claim is matched if the token has one | The `aud` claim is required and must match one entry |
| `audiences` omitted or empty | Audience validation is disabled | Audience validation is disabled |

The `requiredClaims` field is unchanged and still defaults to `["exp"]`. The `iss` and `aud` requirements are added on top of whatever you list there, so an empty `requiredClaims` list no longer means that no claims are required.

**Actions to take**: Confirm that your identity provider issues an `iss` claim in the tokens that reach agentgateway. Most providers do. If you accept tokens that have no `aud` claim, remove `audiences` from the policy or set it to an empty list, because a non-empty list now rejects those tokens. For the policy fields, see [JWT authentication]({{< link-hextra path="/security/jwt/" >}}).

### Cross-namespace route delegation requires a `ReferenceGrant`

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3110 -->

In route delegation, a parent route attaches to a child `HTTPRoute` that has no `parentRefs`. When the parent and the child are in different namespaces, the attachment previously needed no authorization from the child. Agentgateway now requires a `ReferenceGrant` in the child's namespace that allows `HTTPRoute` references from the parent's namespace, matching how Gateway API governs every other cross-namespace reference.

**Actions to take**: For each cross-namespace delegation, create a `ReferenceGrant` in the child route's namespace, as in the following example. Delegation within a single namespace is unaffected.

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-parent-delegation
  namespace: team-a
spec:
  from:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    namespace: infra
  to:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
```

For more information, see [Route delegation]({{< link-hextra path="/traffic-management/route-delegation/" >}}).

### `AgentgatewayModel` model routers are scoped to a route

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2973 -->

Agentgateway used to create a model router implicitly for every listener that an `AgentgatewayModel` bound to, which meant that every model with that listener as a `parentRef` shared one implicit route. Model router creation and route registration are now explicit.

A default model router and route are still created per listener when an `AgentgatewayModel` has a `Gateway` or `ListenerSet` as its `parentRef`, so a configuration that uses only listener parents keeps working. To run more than one model router on the same listener, for example on different paths, create an `HTTPRoute` for each router and point the models at it. Such a route must meet all of the following requirements.

- The kind must be `HTTPRoute`.
- The route must have at least one rule with a path prefix match. If it has more than one rule, the model's `parentRef` must name the rule with a `sectionName`.
- The route must have exactly one `backendRef`, with no port, `kind: AgentgatewayModel`, and `name: "*"`.
- That `backendRef` must have a weight of `1` and no filters.

**Actions to take**: Review any `AgentgatewayModel` whose `parentRef` names an `HTTPRoute`, and confirm that the route meets the requirements. A route that does not is reported in the model's status. For more information, see [Models]({{< link-hextra path="/llm/models/" >}}).

### AI policies on a backend merge with an attached policy

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2821 -->

An AI policy set directly on a backend used to replace an attached AI policy in full. If the backend set even one field, every field of the attached policy was dropped, including prompt guards, prompt enrichment, defaults, transformations, model aliases, and prompt caching. The two policies now merge field by field, and the backend's value wins for a field that both of them set.

**Actions to take**: Review each `AgentgatewayBackend` that sets `spec.ai.groups[].providers[].policies.ai` alongside an `AgentgatewayPolicy` that sets `spec.backend.ai`. A field that the `AgentgatewayPolicy` sets, and the backend does not, now takes effect where it was previously ignored. Remove any field from the `AgentgatewayPolicy` that you do not want the backend to inherit.

## ⚠️ Removed or deprecated {#v15-removed-deprecated}

### The `MODEL_CATALOG_PATHS` environment variable is removed

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2772 -->

Agentgateway no longer reads the `MODEL_CATALOG_PATHS` environment variable, because it could not be reconciled with dynamic configuration reloading. Most deployments are unaffected. When you supply a model cost catalog through the `AgentgatewayParameters` resource, the controller now writes the mounted ConfigMap path into the generated configuration, and the resource keeps working unchanged.

**Actions to take**: If you set `MODEL_CATALOG_PATHS` yourself, in `spec.env` on an `AgentgatewayParameters` resource or in your Helm values, move the catalog to the `AgentgatewayParameters` model catalog field. Agentgateway silently ignores the environment variable, so a catalog that you load this way stops being applied after you upgrade. For the field, see the [API reference]({{< link-hextra path="/reference/api/" >}}).

### The Istio identity TLV is no longer sent over HBONE

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2951 -->

Agentgateway no longer sends the Istio-specific identity type-length-value (TLV) field on HBONE connections. The TLV existed so that agentgateway could be sandwiched with ztunnel and pass its peer identity along. That sandwich pattern is no longer recommended. Let agentgateway terminate mTLS directly instead.

**Actions to take**: If you sandwich agentgateway with ztunnel and rely on the forwarded identity in an authorization policy, move that policy to agentgateway. Agentgateway sees the peer identity through the `source.tls.identity` and `source.spiffeId` CEL attributes. A sandwich deployment still works, but without native identity propagation. For the recommended patterns, see [Istio ambient mesh]({{< link-hextra path="/integrations/istio/" >}}).

### The `agctl costs` command is renamed to `agctl catalog`

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2927 -->

The `agctl` command that manages model catalogs is renamed from `agctl costs` to `agctl catalog`, because a catalog entry now carries more than pricing data. The subcommand and its flags do not change, and the command produces the same catalog JSON. The `agctl costs` command still runs the same code, but it is deprecated and reports that you must use `agctl catalog` instead. Agentgateway plans to remove `agctl costs` in a future release.

**Actions to take**: Replace `agctl costs` with `agctl catalog` in any script or pipeline that generates a model catalog. For the flags and examples, see the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference.

## 🌟 New features {#v15-new-features}

### LLM {#v15-features-llm}

#### Native Gemini inbound API {#v15-gemini-inbound}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2963 -->

Clients that are built on the Gemini or Vertex AI SDKs can now call agentgateway in Gemini's native wire format, rather than through an OpenAI-compatible endpoint. Two route types are added to the AI policy `routes` map, and by default agentgateway maps paths to them automatically.

| Route type | Default paths |
| --- | --- |
| `GenerateContent` | Paths that end in `:generateContent` or `:streamGenerateContent` |
| `GeminiCountTokens` | Paths that end in `:countTokens` |

The model comes from the `models/{model}` path segment, so any `gemini-*` model works without per-model configuration. Streaming requires `alt=sse`, because Gemini's default JSON-array streaming mode is not supported. Guardrails apply to `GenerateContent`, and are skipped for `GeminiCountTokens`. A Gemini request to a non-Gemini provider returns an explicit unsupported-conversion error.

For the route types, see the [API reference]({{< link-hextra path="/reference/api/" >}}).

#### Anthropic Messages to OpenAI Responses conversion {#v15-anthropic-responses}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2689 -->

Agentgateway can now translate an Anthropic Messages request into an OpenAI Responses request, and translate the buffered or streamed reply back into the Messages format. Use it when a client sends `/v1/messages` but the provider that you route to advertises only the Responses format. The existing Messages-to-Completions path still takes precedence for providers that advertise both formats, so dual-format OpenAI and Azure OpenAI providers are unchanged.

For the supported providers, see the [LLM providers]({{< link-hextra path="/llm/providers/" >}}) docs.

#### OpenAI inline moderation

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2519 -->

An OpenAI provider can now carry a `moderation` block that agentgateway injects into chat completions and Responses requests, so that OpenAI moderates the request inline rather than in a separate call. The gateway sets the configuration, which means a client cannot turn moderation off or weaken it. You choose a moderation model and set `block` or `score` mode independently for input and output.

```yaml
provider:
  openAI:
    model: gpt-5
    moderation:
      model: omni-moderation-latest
      policy:
        input:
          mode: block
        output:
          mode: score
```

This is separate from the existing OpenAI moderation guardrail, which calls the Moderation API from the gateway. For that approach, see [OpenAI moderation]({{< link-hextra path="/llm/guardrails/moderation/" >}}).

#### Guardrails can scan tool input and output

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3000 -->

A prompt guard now takes an optional `scope` list that selects which parts of an LLM request it inspects. The accepted values are `SystemPrompt`, `Messages`, `ToolOutput`, and `ToolInput`. Tool content is opt in, so a guard without a `scope` behaves as it did before. Scoping is currently supported by the regex guard.

For the field, the caveats on masking opaque tool arguments, and examples, see [Regex guardrails]({{< link-hextra path="/llm/guardrails/regex/" >}}).

#### Transformations after provider conversion

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2912 -->

Transformations run before agentgateway converts a request into the provider's format, so writing one meant understanding how that conversion works, and fields that the conversion adds could not be changed at all. A new `finalTransformations` field on `AgentgatewayModel` and `AgentgatewayPolicy` runs after the conversion instead. You only need to know the shape of the target API.

For more information, see [Transformations]({{< link-hextra path="/llm/transformations/" >}}).

#### Other LLM improvements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2927 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3128 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2830 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2934 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2820 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2766 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3058 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2858 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2856 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2848 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3097 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3015 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2850 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2861 -->

- **Catalog tags**: A catalog entry carries a freeform `tags` list alongside its pricing rates and tiers, which is why `agctl costs` became `agctl catalog`. Use tags to record capability or routing information about a model. The initial catalog refresh at startup is also fixed.
- **Provider override for custom providers**: A custom provider takes an optional `providerOverride` that sets the provider identity used for cost catalog lookup and telemetry. Without it, the existing `custom` fallback is used. The field is available on both `AgentgatewayModel` and `AgentgatewayBackend`.
- **Bedrock**: Amazon Nova multimodal embeddings and Cohere v4 embeddings are supported. This release also corrects `top_k` translation, handles image URLs consistently across input types, and mutates a guardrail payload in place so that the original structure is preserved.
- **GitHub Copilot and DeepSeek**: Grok models are routed through the Responses API, and the DeepSeek preset advertises the Responses format.
- **Prompt caching across formats**: OpenAI cache markers are translated into their Anthropic and Bedrock equivalents.
- **Vertex AI embeddings**: `gemini-embedding-2` and later models are routed to the `:embedContent` endpoint, because Google no longer serves `:predict` for them. The `gemini-embedding-001` and `text-embedding-*` models stay on `:predict`. Because `:embedContent` embeds one input per call, a multi-input array returns an explicit error instead of collapsing into a single vector.
- **Token counting**: The count-tokens endpoint is routed by default, and an Anthropic thinking budget is capped by the request's maximum token count.
- **Failover authorization**: An `AgentgatewayModel` configures authorization correctly for its failover targets.
- **Guardrail refactor**: Guardrails are restructured internally, and prompt guard logs record which pattern matched.
- **Error handling**: Proxy errors are classified by the phase they occurred in, and the original upstream HTTP status code is preserved on an error response.

For the list of supported providers, see the [LLM providers]({{< link-hextra path="/llm/providers/" >}}) docs, and for cost tracking, see [Cost tracking]({{< link-hextra path="/llm/cost-controls/costs/" >}}).

### Security {#v15-features-security}

#### Namespace-scoped write permissions for the controller {#v15-rbac}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3102 -->

The controller Helm chart can now grant its write permissions in named namespaces instead of cluster-wide. Set `rbac.gatewayNamespaces` to the list of namespaces that hold your `Gateway` resources. The chart then creates namespaced roles for the objects that the controller provisions, and the cluster-wide role keeps only read access to them.

```yaml
rbac:
  gatewayNamespaces:
  - gateway-system
  - team-a
```

The default is an empty list, which preserves the existing cluster-wide write access, so an upgrade does not change permissions on its own. Cluster-wide read permissions and writes to cluster-scoped resources, such as `GatewayClass` and status subresources, are unaffected. When you set the list, the namespaces must already exist, and only `Gateway` resources in those namespaces can be used.

For the provisioned objects and the chart values, see the [Helm reference]({{< link-hextra path="/reference/helm/" >}}).

#### Signed JWT backend authentication

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2515 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2849 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2763 -->

A new `jwtSign` backend authentication method signs a JSON Web Token per request with a private key that you supply, and attaches it to the backend request. Use it for upstreams that require a keypair-signed JWT rather than a static credential, such as the Snowflake SQL API. You reference the signing key through a Secret, and claim values accept CEL expressions, so you can derive a claim from the incoming request.

For the key ID, token lifetime, claims, placement, and supported algorithms, see [Signed JWT backend authentication]({{< link-hextra path="/security/backend-authn-jwt-sign/" >}}).

#### Secret references for backend CA certificates

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2868 -->

The backend TLS configuration in an `AgentgatewayPolicy` can now read a CA bundle from a Kubernetes Secret as well as from a ConfigMap. Set `kind: Secret` on a `caCertificateRefs` entry, or set `kind: ConfigMap` explicitly. ConfigMap remains the default, so existing policies are unchanged. The controller watches the referenced Secret, so a CA rotation reaches dependent resources, and it does not fall back between a Secret and a ConfigMap that share a name.

Gateway API `BackendTLSPolicy` still accepts only ConfigMap references, because its upstream API constrains it. For more information, see [Backend TLS]({{< link-hextra path="/security/backendtls/" >}}).

#### Cross App Access and token exchange enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2770 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2750 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2892 -->

- **Separate scopes per leg**: Cross App Access takes a new `accessTokenScopes` field, which sets the scopes for the access-token exchange independently of the scopes that request the OAuth Identity Assertion Authorization Grant (ID-JAG). Omit the field to inherit `scopes`. Set an empty list to omit the `scope` parameter entirely, which some authorization servers require, such as an Okta custom authorization server.
- **Configurable subject token type**: Cross App Access takes `subjectToken.tokenType`, so a workload identity that authenticates with client credentials can exchange an access token. The default is still `id_token`.
- **Optional `requested_token_type`**: The parameter is optional in OAuth token exchange, which matches [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693).

For more information, see [Cross App Access]({{< link-hextra path="/security/backend-authn-cross-app-access/" >}}) and [OAuth token exchange]({{< link-hextra path="/security/backend-authn-oauth/" >}}).

#### Other security improvements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2640 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3144 -->

- **SPIFFE Workload API identity**: Add a `spiffe` block to the `AgentgatewayParameters` resource to source the mTLS identity and trust bundle from a local SPIFFE Workload API, such as a SPIRE agent. The identity then replaces a static certificate and key. The controller mounts the Workload API socket into the gateway pod, and agentgateway rotates the X.509 SPIFFE Verifiable Identity Document (SVID) without a restart. The socket comes from the SPIFFE Container Storage Interface (CSI) driver by default, and a `hostPath` source is also available. Prefer the CSI source, because `hostPath` mounts an arbitrary host directory into the gateway pod. Listeners and backends then opt in individually with the `agentgateway.dev/tls-certificate-source: SPIFFE` listener option and `backend.tls.certificateSource: SPIFFE` on an `AgentgatewayPolicy`, and the peer identity is available to policies as the `source.spiffeId` CEL attribute. For the fields, see the [API reference]({{< link-hextra path="/reference/api/" >}}) and the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).
- **Client endpoint headers are stripped for inference routing**: The `x-gateway-destination-endpoint` header is an output of the endpoint picker, not an input that a client sets. Agentgateway now removes it from an incoming request before [inference routing]({{< link-hextra path="/llm/inference/" >}}) runs. No action is needed, because the header was already overwritten in most paths.

### MCP and A2A {#v15-features-mcp}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3089 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3009 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2207 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2916 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3059 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2788 -->

- **Authorization server metadata**: Agentgateway rewrites the issuer in the metadata that it serves, so a client that validates the issuer against the gateway address succeeds.
- **Discovery failures are visible**: A discovery failure is reported rather than masked when the backend is in `failOpen` mode.
- **Server-initiated requests**: A client's JSON-RPC response to a server-initiated request is routed back to the server that asked.
- **More targets per backend**: An MCP backend accepts up to 128 targets, raised from 32.
- **Trace context**: An MCP call's upstream trace context is derived from the gateway's active span, and the `rmcp` library is updated to 3.1.0.

For more information, see the [MCP]({{< link-hextra path="/mcp/" >}}) docs.

### Traffic management {#v15-features-traffic}

#### Inline URLs for policy backends {#v15-inline-urls}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2125 -->

A policy field that points at an external service now accepts a `url` as an alternative to a `backendRef`. Those fields include a JWKS endpoint, an OTLP collector, an external authorization or external processing server, a remote rate limit service, and a tunnel proxy. You no longer have to create an intermediate Kubernetes object just to describe an HTTPS endpoint.

- Use `backendRef` when you want Kubernetes service discovery, namespace scoping, a reusable backend, or backend policies attached to it.
- Use `url` when the target is naturally a direct HTTP or HTTPS endpoint. An HTTPS URL produces an inline backend TLS policy automatically, and the URL path is preserved where it is meaningful, such as for JWKS and OTLP. A tunnel URL is validated as origin-only, because a tunnel proxy is not an HTTP resource path.

For the fields, see the [API reference]({{< link-hextra path="/reference/api/" >}}).

#### Egress proxying, TCP backends, and CONNECT tunneling {#v15-egress}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3013 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3118 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3095 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3124 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3098 -->

This release fills in the pieces that agentgateway needs to serve as an egress proxy for agent workloads.

- **Dynamic backends for TCP**: A TCP route can use a dynamic backend, so the destination comes from the connection rather than from static configuration. The controller now translates TCP backends, which the proxy already supported.
- **Tunnel mode**: The backend tunnel policy takes a `mode` field. The default `auto` mode uses `CONNECT` for TLS and non-HTTP transports, and absolute-form requests for plaintext HTTP. The `connect` mode uses `CONNECT` for everything. You can also attach policies to the connection with the tunnel proxy itself, and `CONNECT` requests can be tunneled through a dynamic proxy backend.
- **Forward proxy authentication**: A client can authenticate with the `Proxy-Authorization` header instead of `Authorization`. Set the authentication policy's `location` to that header. Agentgateway strips the header before the request goes upstream and marks it sensitive so that its value is not logged. A failed `CONNECT` authentication returns a `407` response with a `Proxy-Authenticate` header, as [RFC 9110](https://datatracker.ietf.org/doc/html/rfc9110) requires.
- **Backend connection timeouts**: The controller now translates the `backend.tcp` section of a policy, so `connectTimeout` and the `keepalive` settings take effect on connections to a destination. A policy that set them in an earlier version was accepted but had no effect. The `backend.http.requestTimeout` field sets the deadline for a response.

For the tunnel proxy, see [Backend tunnel proxy]({{< link-hextra path="/llm/providers/backend-tunnel-proxy/" >}}), and for the timeout fields, see [Connection settings]({{< link-hextra path="/resiliency/connection/" >}}).

#### Rate limiting enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2952 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2839 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2661 -->

- **Multiple local limits**: An `AgentgatewayPolicy` can define more than one local rate limit, which standalone mode already supported.
- **Dynamic limit overrides**: A remote rate limit descriptor takes an optional `limitOverride`, validated as CEL and forwarded to the rate limit service, so a limit can be computed per request.
- **Consistent headers**: The `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset` headers are returned on every rate-limited response, for both local and remote rate limiting, rather than only on some paths.

For more information, see [HTTP rate limits]({{< link-hextra path="/security/rate-limit-http/" >}}) and [Global rate limits]({{< link-hextra path="/security/rate-limit-global/" >}}).

#### CEL enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2845 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/1975 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2855 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2836 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2835 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2970 -->

- **Every request policy is registered for CEL**: All request policies are available in the CEL context, not just a subset.
- **Cost-class routing**: A worked example derives a cost class from the request body with plain CEL and routes the same public model name to different upstream models.
- **Internal improvements**: A CEL error can be serialized to a string without leaking potentially private detail. Expression analysis can inspect call arity and function-versus-method usage. A parser bug is fixed, and `has()` takes a fast path for dynamic objects.

For the full CEL surface, see the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).

### Operations {#v15-features-operations}

#### Observability enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3027 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3068 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3100 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2920 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3141 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2110 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3079 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2888 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3149 -->

- **Admin UI**: A redesigned logs view, clearer multi-turn conversation rendering, and a trajectory view for agent activity with tool call and result details.
- **Spans for every policy call**: Tracing emits an outbound span for the upstream call and for each policy callout, such as external authorization or a guardrail webhook. MCP and gRPC spans are named with protocol-specific information, and request tracing with `agctl` follows the same outbound calls.
- **Protobuf metrics**: The `/metrics` and `/stats/prometheus` endpoints negotiate the response format from the `Accept` header, so a scraper that asks for `application/vnd.google.protobuf` gets protobuf instead of text.
- **Native histograms**: The proxy can collect classic histogram buckets, native buckets, or both. Native histograms are exposed only through the Prometheus protobuf format, and classic remains the default because native histograms add scrape overhead.
- **LLM token timing in access logs**: Access logs record time-to-first-token and related timing for LLM requests.
- **CPU and heap profiles**: A new `agctl proxy profile` command collects pprof CPU and heap profiles from the proxy admin endpoint.
- **Generated metrics reference**: The metrics documentation is generated from the schema, so it stays in step with the code.

For more information, see [Observability]({{< link-hextra path="/observability/" >}}) and the [`agctl proxy profile`]({{< link-hextra path="/reference/agctl/agctl-proxy-profile/" >}}) reference.

#### Other operations improvements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2739 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3052 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2972 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2737 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2909 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3099 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2950 -->

- **Custom xDS request headers**: Set `XDS_HEADER_*` environment variables on the proxy to attach operator-defined headers, such as `x-istio-revision` or a tenant identifier, to outbound xDS requests. The headers are validated at startup.
- **ListenerSet postrouting policies**: The proxy applies postrouting policies that a `ListenerSet` attaches, which the controller already translated.
- **Controller chart values**: The controller Helm chart adds `controller.revisionHistoryLimit` and `dnsConfig`. For the chart values, see the [Helm reference]({{< link-hextra path="/reference/helm/" >}}).
- **Pluggable cryptography**: A `crypto` module centralizes random number generation, authenticated encryption with associated data (AEAD), digest, JWT, and TLS provider selection behind `crypto-*` build flags. A SymCrypt provider is available for builds that need it. AWS-LC remains the default.
- **Shared duration type**: Duration fields across the CRDs use one shared type, which simplifies their validation rules.

## 🐛 Fixes {#v15-fixes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3017 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2735 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3103 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2964 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2775 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2846 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2991 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3008 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3087 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2983 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3073 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2851 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3088 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3044 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2872 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2885 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2971 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2771 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2791 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2813 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2801 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3005 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2977 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2804 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3002 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2976 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3140 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2794 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3034 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3116 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3101 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2998 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2699 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2907 -->

**Security**

- Valid JWKS targets are restricted, an invalid inline JWKS reports an error, and an invalid JWT produces a clearer message.
- Azure managed identity rejects multiple identity selectors and aligns its schema naming.

**MCP and A2A**

- A2A path rewriting is fixed, interface URL rewriting is correct when a path rewrite policy is active, and A2A v1.0 nested payloads record response telemetry and the context ID.

**LLM**

- Bedrock virtual models no longer bypass the transformed model on the upstream path, and Bedrock streaming indexes, invalid function inputs, and image URL handling are fixed.
- Gemini usage is extracted from the Cloud Code `response` envelope, and parallel tool calls are preserved across the Gemini and Completions conversions.
- Anthropic streaming sets the role on the first delta, honors the final input usage, and no longer fails the whole request when a server tool errors.
- A multi-turn request whose previous turn returned empty tool arguments no longer fails validation.
- An `InferenceRouting` policy resolves for AI provider backends.

**Traffic management**

- Listener port swaps are reconciled dynamically, and a bind that transitions to an internal bind is stopped.
- Invalid header modifications are rejected, route policy application is more consistent, and a `:authority` mutation is no longer a no-op for `CONNECT` requests.

**Status and resource reporting**

- `AgentgatewayModel` reports status, and the controller writes `InferencePool` status for pools that a model references. Redundant `InferencePool` status writes are suppressed.
- A failure to write a deployed object is reported in status rather than only logged, and a policy that targets a missing `sectionName` is surfaced in status.
- Conflicts on an internal `Gateway` or `ListenerSet` are handled correctly.
- `AgentgatewayModel` appears in the configuration dump, so `agctl` can inspect it.

**Operations**

- A negative duration is clamped to zero instead of being rejected, and upstream connect duration is recorded at full precision.
- The admin UI analytics summary no longer loops its request.
- The controller validates with CEL that a port is a number.

For the complete list of fixes, see the [GitHub release notes](https://github.com/agentgateway/agentgateway/releases).
