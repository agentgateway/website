---
title: Release notes
weight: 20
description: What's new, changed, and fixed in each agentgateway on Kubernetes release.
test: skip
---

Review the release notes for agentgateway on Kubernetes.

> [!NOTE]
> For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).

## 🔥 Breaking changes {#v15-breaking-changes}

### LLM input and total token counts include cache tokens

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2880 -->

LLM providers disagree about whether the input token count in a response includes the tokens that the provider read from or wrote to its prompt cache. Anthropic and Amazon Bedrock exclude cached tokens from the input count. OpenAI, Azure OpenAI, and Google Gemini include them. Agentgateway used to pass each provider's number through unchanged, so the same prompt produced different token counts depending on which provider served it.

Agentgateway now normalizes the counts so that they mean the same thing for every provider.

- `llm.inputTokens` is the total input count, including cache-read and cache-creation tokens.
- `llm.totalTokens` is the normalized input count plus the output count.
- `llm.providerInputTokens` is a new field that reports the input count exactly as the provider sent it.
- `llm.providerTotalTokens` is a new field that reports the total count exactly as the provider sent it.

The `llm.cachedInputTokens` and `llm.cacheCreationInputTokens` fields do not change. Both are now always a subset of `llm.inputTokens`, for every provider.

Only the providers that previously excluded cached tokens report different values. Those providers are Anthropic, Amazon Bedrock, Anthropic models served through Vertex AI or GitHub Copilot, and custom providers that use the `messages` or `anthropicTokenCount` format. Requests that do not use prompt caching are not affected, because the cache-read and cache-creation counts are zero.

The normalized counts reach every feature that reads a token count. This includes the `gen_ai.usage.input_tokens` log and span field, the `agentgateway_gen_ai_client_token_usage` metric, token-based rate limits, and any CEL expression that reads `llm.inputTokens` or `llm.totalTokens`. Cost tracking and the `llm.cost` field do not change, because the model cost catalog already priced cache-read and cache-creation tokens separately.

**Actions to take**: To keep the provider's unmodified value in a CEL expression, custom log field, custom metric, or rate limit descriptor, read `llm.providerInputTokens` or `llm.providerTotalTokens` instead. Review each token-based rate limit that you sized against a provider that excluded cached tokens, because requests now consume the limit sooner. Annotate the upgrade in any dashboard that trends input tokens, so that the step change is not read as a traffic change.

To restore the previous behavior while you migrate, set the `AGENTGATEWAY_LEGACY_LLM_USAGE_TOKEN_SEMANTICS` environment variable to `true` on the proxy. In Kubernetes mode, set the variable in `spec.env` on an `AgentgatewayParameters` resource. Agentgateway plans to remove this variable after version 1.5, so treat it as a short-term migration aid and not as a supported configuration.

For guidance on which field to read, see [Token usage fields]({{< link-hextra path="/llm/observability/#token-usage-fields" >}}). For the full list of fields in the CEL context, see the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).

### JWT validation requires the `iss` claim, and `aud` when you configure audiences

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2993 -->

A JWT authentication policy always configures an `issuer`, and it can configure a list of `audiences`. In earlier releases, agentgateway compared those settings against the token's `iss` and `aud` claims only when the token contained them. A token that omitted `iss`, or that omitted `aud` when the policy set `audiences`, passed validation because neither claim was in the required set.

Agentgateway now requires the claim whenever the corresponding setting exists.

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

Agentgateway no longer reads the `MODEL_CATALOG_PATHS` environment variable. The variable could not be reconciled with dynamic configuration reloading, and the same catalog sources are set in the proxy configuration instead.

Most deployments are unaffected. When you supply a model cost catalog through the `AgentgatewayParameters` resource, the controller now writes the mounted ConfigMap path into the generated configuration. The resource keeps working unchanged.

**Actions to take**: If you set `MODEL_CATALOG_PATHS` yourself, in `spec.env` on an `AgentgatewayParameters` resource or in your Helm values, move the catalog to the `AgentgatewayParameters` model catalog field. Agentgateway silently ignores the environment variable, so a catalog that you load this way stops being applied after you upgrade. For the field, see the [API reference]({{< link-hextra path="/reference/api/" >}}).

### The Istio identity TLV is no longer sent over HBONE

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2951 -->

Agentgateway no longer sends the Istio-specific identity type-length-value (TLV) field on HBONE connections. The TLV existed so that agentgateway could be sandwiched with ztunnel and pass its peer identity along. That sandwich pattern is no longer recommended. Let agentgateway terminate mTLS directly instead.

**Actions to take**: If you sandwich agentgateway with ztunnel and rely on the forwarded identity in an authorization policy, move that policy to agentgateway. Agentgateway sees the peer identity through the `source.tls.identity` and `source.spiffeId` CEL attributes. A sandwich deployment still works, but without native identity propagation. For the recommended patterns, see [Istio ambient mesh]({{< link-hextra path="/integrations/istio/" >}}).

### The `agctl costs` command is renamed to `agctl catalog`

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2927 -->

The `agctl` command that manages model catalogs is renamed from `agctl costs` to `agctl catalog`, because a catalog entry now carries more than pricing data. The subcommand and its flags do not change: `agctl catalog import` takes the same `--source`, `--providers`, `--legacy`, `--pretty`, and `--out` flags that `agctl costs import` took, and it produces the same catalog JSON.

The `agctl costs` command still runs the same code, but it is deprecated and reports that you must use `agctl catalog` instead. Agentgateway plans to remove `agctl costs` in a future release.

**Actions to take**: Replace `agctl costs` with `agctl catalog` in any script or pipeline that generates a model catalog. For the flags and examples, see the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference.


## 🌟 New features {#v15-new-features}

Version 1.5 adds SPIFFE workload identity, native Gemini and Anthropic API surfaces, Secret-based CA references, and an egress mode for outbound traffic. Guardrails, rate limiting, CEL, and status reporting each gain new options.

### Security {#v15-features-security}

#### mTLS identity from the SPIFFE Workload API

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2640 -->

Agentgateway can source its mTLS identity from a local SPIFFE Workload API, such as a SPIRE agent, instead of from a static certificate and key. Add a `spiffe` block to the `AgentgatewayParameters` resource. The controller then mounts the Workload API socket into the gateway pod. Agentgateway keeps the X.509 SPIFFE Verifiable Identity Document (SVID) and the trust bundle current in the background, and rotates them without a restart.

```yaml
spiffe:
  source:
    csi: {}
```

The socket comes from the SPIFFE Container Storage Interface (CSI) driver by default. The defaults are `csi.spiffe.io` for the driver name, `/spiffe-workload-api` for the mount path, and `spire-agent.sock` for the socket name. A `hostPath` source is also available, but it mounts an arbitrary host directory into the gateway pod. Prefer the CSI source, and restrict `hostPath` to `GatewayClass`-level parameters that cluster administrators manage. Set `enabled: false` on a `Gateway`-level `AgentgatewayParameters` to opt one gateway out of SPIFFE that is turned on at the `GatewayClass` level.

Listeners and backends then opt in individually.

- Set the `agentgateway.dev/tls-certificate-source: SPIFFE` listener option to terminate TLS with the SPIFFE-issued SVID.
- Set `backend.tls.certificateSource: SPIFFE` on an `AgentgatewayPolicy` to use the same identity for outbound mTLS.

The peer's raw SPIFFE ID is available to policies through the `source.spiffeId` CEL attribute. Because SPIFFE support is new in this release, it is not yet covered by a dedicated guide. For the fields available today, see the [API reference]({{< link-hextra path="/reference/api/" >}}), and for the new CEL attribute, see the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).

#### Signed JWT backend authentication

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2515 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2849 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2763 -->

A new `jwtSign` backend authentication method signs a JSON Web Token per request with a private key that you supply, and attaches it to the backend request. Use it for upstreams that require a keypair-signed JWT rather than a static credential, such as the Snowflake SQL API. You configure the signing key through a Secret reference, an optional key ID, the token lifetime, the claims to sign, and where to place the token on the request. The supported signing algorithms are `RS256`, `RS384`, `RS512`, `PS256`, `ES256`, and `ES384`. Claim values accept CEL expressions, so you can derive a claim from the incoming request.

For more information, see [Signed JWT backend authentication]({{< link-hextra path="/security/backend-authn-jwt-sign/" >}}).

#### Secret references for backend CA certificates

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2868 -->

The backend TLS configuration in an `AgentgatewayPolicy` can now read a CA bundle from a Kubernetes Secret as well as from a ConfigMap. Set `kind: Secret` on a `caCertificateRefs` entry, or set `kind: ConfigMap` explicitly. ConfigMap remains the default, so existing policies are unchanged. The controller watches the referenced Secret, so a CA rotation reaches dependent resources. The controller does not fall back between a Secret and a ConfigMap that share a name.

Gateway API `BackendTLSPolicy` still accepts only ConfigMap references, because its upstream API constrains it. For more information, see [Backend TLS]({{< link-hextra path="/security/backendtls/" >}}).

#### Cross App Access and token exchange enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2770 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2750 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2892 -->

- **Separate scopes per leg**: Cross App Access takes a new `accessTokenScopes` field. The field sets the scopes for the access-token exchange independently of the scopes that request the OAuth Identity Assertion Authorization Grant (ID-JAG). Omit the field to inherit `scopes`, which preserves the current behavior. Set an empty list to omit the `scope` parameter entirely, which some authorization servers require, such as an Okta custom authorization server.
- **Configurable subject token type**: Cross App Access takes `subjectToken.tokenType`, so a workload identity that authenticates with client credentials can exchange an access token. The default is still `id_token`.
- **Optional `requested_token_type`**: The parameter is optional in OAuth token exchange, which matches [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693).

For more information, see [Cross App Access]({{< link-hextra path="/security/backend-authn-cross-app-access/" >}}) and [OAuth token exchange]({{< link-hextra path="/security/backend-authn-oauth/" >}}).

#### Inference routing ignores a client-supplied endpoint header

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3144 -->

The `x-gateway-destination-endpoint` header names the model server endpoint that an inference request is sent to. The header is an output of the endpoint picker, not an input that a client is allowed to set. Agentgateway now strips the header from an incoming request before inference routing runs, so a client can no longer choose its own model server endpoint by setting the header.

No action is needed. If a client sets the header today, it was already being overwritten in most paths, and it is now removed in all of them. For more information, see [Inference routing]({{< link-hextra path="/llm/inference/" >}}).

#### Namespace-scoped write permissions for the controller

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3102 -->

The controller Helm chart can now grant its write permissions in named namespaces instead of cluster-wide. Set `rbac.gatewayNamespaces` to the list of namespaces that hold your `Gateway` resources. The chart then creates namespaced roles for the objects that the controller provisions. Those objects are ConfigMaps, Secrets, Services, ServiceAccounts, Deployments, DaemonSets, HorizontalPodAutoscalers, and PodDisruptionBudgets. The cluster-wide role keeps only read access to them.

```yaml
rbac:
  gatewayNamespaces:
  - gateway-system
  - team-a
```

The default is an empty list, which preserves the existing cluster-wide write access, so an upgrade does not change permissions on its own. Cluster-wide read permissions and writes to cluster-scoped resources, such as `GatewayClass` and status subresources, are unaffected.

When you set the list, the namespaces must already exist, and only `Gateway` resources in those namespaces can be used. For the chart values, see the [Helm reference]({{< link-hextra path="/reference/helm/" >}}).

### MCP and A2A {#v15-features-mcp}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3089 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3009 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2207 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2916 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3059 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2788 -->

- **Authorization server metadata**: Agentgateway rewrites the issuer in the authorization server metadata that it serves, so a client that validates the issuer against the gateway address succeeds.
- **Discovery failures are visible**: A discovery failure is reported rather than masked when the backend is in `failOpen` mode.
- **Server-initiated requests**: A client's JSON-RPC response to a server-initiated request is routed back to the server that asked.
- **More targets per backend**: An MCP backend accepts up to 128 targets, raised from 32.
- **Trace context**: An MCP call's upstream trace context is derived from the gateway's active span.
- **Protocol library**: The `rmcp` library is updated to 3.1.0.

For more information, see the [MCP]({{< link-hextra path="/mcp/" >}}) docs.

### LLM {#v15-features-llm}

#### Native Gemini inbound API

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2963 -->

Clients that are built on the Gemini or Vertex AI SDKs can now call agentgateway in Gemini's native wire format, rather than through an OpenAI-compatible endpoint. Two route types are added to the AI policy `routes` map, and by default agentgateway maps paths to them automatically.

| Route type | Default paths |
| --- | --- |
| `GenerateContent` | Paths that end in `:generateContent` or `:streamGenerateContent` |
| `GeminiCountTokens` | Paths that end in `:countTokens` |

The model comes from the `models/{model}` path segment, so any `gemini-*` model works without per-model configuration. Streaming requires `alt=sse`. Gemini's default JSON-array streaming mode is not supported. Guardrails apply to `GenerateContent`, and are skipped for `GeminiCountTokens`. Thinking configuration and returned thought parts pass through unchanged.

Native Gemini input targets Gemini-family backends. A Gemini request to a non-Gemini provider returns an explicit unsupported-conversion error. For the route types, see the [API reference]({{< link-hextra path="/reference/api/" >}}).

#### Anthropic Messages to OpenAI Responses conversion

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2689 -->

Agentgateway can now translate an Anthropic Messages request into an OpenAI Responses request, and translate the buffered or streamed reply back into the Messages format. Use it when a client sends `/v1/messages` but the provider that you route to advertises only the Responses format.

The existing Messages-to-Completions path still takes precedence for providers that advertise both formats, so dual-format OpenAI and Azure OpenAI providers are unchanged. The conversion covers a common agent subset, including text, system instructions, image inputs by URL, base64 data, or file ID, tool calls, and streaming. For the supported providers, see the [LLM providers]({{< link-hextra path="/llm/providers/" >}}) docs.

#### Transformations after provider conversion

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2912 -->

Transformations run before agentgateway converts a request into the provider's format, so writing one meant understanding how that conversion works, and fields that the conversion adds could not be changed at all. A new `finalTransformations` field on `AgentgatewayModel` and `AgentgatewayPolicy` runs after the conversion instead. You only need to know the shape of the target API.

```yaml
finalTransformations:
- field: reasoning_effort
  expression: 'fail("remove")'
- field: max_tokens
  expression: '600'
```

For more information, see [Transformations]({{< link-hextra path="/llm/transformations/" >}}).

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

A prompt guard now takes an optional `scope` list that selects which parts of an LLM request it inspects. The accepted values are `SystemPrompt`, `Messages`, `ToolOutput`, and `ToolInput`. Tool content is opt in, so a guard without a `scope` behaves as it did before.

Scoping is currently supported by the regex guard. In APIs that send tool arguments as opaque JSON, such as Completions, `ToolInput` arguments are treated as a single string, so a masking rule can rewrite the arguments into invalid JSON. For more information, see [Guardrails]({{< link-hextra path="/llm/guardrails/" >}}).

#### Model catalog enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2927 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3128 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2830 -->

- **Catalog tags**: A catalog entry carries a freeform `tags` list alongside its pricing rates and tiers, which is why `agctl costs` became `agctl catalog`. Use tags to record capability or routing information about a model.
- **Provider override for custom providers**: A custom provider takes an optional `providerOverride` that sets the provider identity used for cost catalog lookup and telemetry. Without it, the existing `custom` fallback is used. The field is available on both `AgentgatewayModel` and `AgentgatewayBackend`.
- **Startup refresh**: The initial catalog refresh at startup is fixed.

For more information, see [Cost tracking]({{< link-hextra path="/llm/cost-controls/costs/" >}}) and the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference.

#### LLM gateway enhancements

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

- **Bedrock**: Amazon Nova multimodal embeddings and Cohere v4 embeddings are supported. This release also corrects `top_k` translation, handles image URLs consistently across input types, and mutates a guardrail payload in place so that the original structure is preserved.
- **GitHub Copilot and DeepSeek**: Grok models are routed through the Responses API, and the DeepSeek preset advertises the Responses format.
- **Prompt caching across formats**: OpenAI cache markers are translated into their Anthropic and Bedrock equivalents.
- **Vertex AI embeddings**: `gemini-embedding-2` and later models are routed to the `:embedContent` endpoint, because Google no longer serves `:predict` for them. The `gemini-embedding-001` and `text-embedding-*` models stay on `:predict`. Because `:embedContent` embeds one input per call, a multi-input array now returns an explicit error instead of collapsing into a single vector.
- **Token counting**: The count-tokens endpoint is routed by default, and an Anthropic thinking budget is capped by the request's maximum token count.
- **Failover authorization**: An `AgentgatewayModel` configures authorization correctly for its failover targets.
- **Guardrail refactor**: Guardrails are restructured internally, and prompt guard logs record which pattern matched.
- **Error handling**: Proxy errors are classified by the phase they occurred in, and the original upstream HTTP status code is preserved on an error response.

For the list of supported providers, see the [LLM providers]({{< link-hextra path="/llm/providers/" >}}) docs.

### Traffic management {#v15-features-traffic}

#### Inline URLs for policy backends

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2125 -->

A policy field that points at an external service now accepts a `url` as an alternative to a `backendRef`. Those fields include a JWKS endpoint, an OTLP collector, an external authorization or external processing server, a remote rate limit service, and a tunnel proxy. You no longer have to create an intermediate Kubernetes object just to describe an HTTPS endpoint.

- Use `backendRef` when you want Kubernetes service discovery, namespace scoping, a reusable backend, or backend policies attached to it.
- Use `url` when the target is naturally a direct HTTP or HTTPS endpoint. An HTTPS URL produces an inline backend TLS policy automatically, and the URL path is preserved where it is meaningful, such as for JWKS and OTLP.
- A tunnel URL is validated as origin-only, because a tunnel proxy is not an HTTP resource path.

For the fields, see the [API reference]({{< link-hextra path="/reference/api/" >}}).

#### Forward proxy authentication

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3098 -->

When agentgateway acts as a forward proxy, a client can now authenticate with the `Proxy-Authorization` header instead of `Authorization`. Set the authentication policy's `location` to that header. Agentgateway reads the credential, strips the header before the request goes upstream, and marks it sensitive so that its value is not logged. A failed `CONNECT` authentication returns a `407` response with a `Proxy-Authenticate` header, as [RFC 9110](https://datatracker.ietf.org/doc/html/rfc9110) requires.

For the policy fields, see the [API reference]({{< link-hextra path="/reference/api/" >}}).

#### Egress proxying, TCP backends, and CONNECT tunneling

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3013 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3118 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3095 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3124 -->

This release fills in the pieces that agentgateway needs to serve as an egress proxy for agent workloads.

- **Dynamic backends for TCP**: A TCP route can use a dynamic backend, so the destination comes from the connection rather than from static configuration. The controller now translates TCP backends, which the proxy already supported.
- **Tunnel mode**: The backend tunnel policy takes a `mode` field. The default `auto` mode uses `CONNECT` for TLS and non-HTTP transports, and absolute-form requests for plaintext HTTP. The `connect` mode uses `CONNECT` for everything. You can also attach policies to the connection with the tunnel proxy itself.
- **Tunneling through a dynamic backend**: `CONNECT` requests can be tunneled through a dynamic proxy backend.
- **Backend connection timeouts**: A backend policy sets `connectTimeout`, `handshakeTimeout`, `requestTimeout`, `http1IdleTimeout`, `http2KeepaliveInterval`, `http2KeepaliveTimeout`, and `maxConnectionDuration`.

For the tunnel proxy, see [Backend tunnel proxy]({{< link-hextra path="/llm/providers/backend-tunnel-proxy/" >}}), and for the timeout fields, see [Connection settings]({{< link-hextra path="/resiliency/connection/" >}}).

#### Rate limiting enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2952 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2839 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2661 -->

- **Multiple local limits**: An `AgentgatewayPolicy` can define more than one local rate limit, which standalone mode already supported.
- **Dynamic limit overrides**: A remote rate limit descriptor takes an optional `limitOverride`, validated as CEL and forwarded to the rate limit service, so a limit can be computed per request.
- **Consistent headers**: The `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset` headers are returned on every rate-limited response, for both local and remote rate limiting, rather than only on some paths. Clients that back off based on those headers behave correctly when an LLM token limit is what rejected the request.

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
- **Safer error strings**: A CEL error can be serialized to a string without leaking potentially private detail.
- **Static checking of call signatures**: Expression analysis can inspect call arity and function-versus-method usage, not just the names that an expression references.
- **Parser and performance fixes**: A parser bug fix and a `has()` fast path for dynamic objects.

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

- **Protobuf metrics**: The `/metrics` and `/stats/prometheus` endpoints negotiate the response format from the `Accept` header, so a scraper that asks for `application/vnd.google.protobuf` gets protobuf instead of text.
- **Native histograms**: The proxy can collect classic histogram buckets, native buckets, or both. Native histograms are exposed only through the Prometheus protobuf format, and classic remains the default because native histograms add scrape overhead.
- **Spans for every policy call**: Tracing emits an outbound span for the upstream call and for each policy callout, such as external authorization or a guardrail webhook. MCP and gRPC spans are named with protocol-specific information, and request tracing with `agctl` follows the same outbound calls.
- **LLM token timing in access logs**: Access logs record time-to-first-token and related timing for LLM requests.
- **Generated metrics reference**: The metrics documentation is generated from the schema, so it stays in step with the code.
- **CPU and heap profiles**: A new `agctl proxy profile` command collects pprof CPU and heap profiles from the proxy admin endpoint.
- **Admin UI**: A redesigned logs view, clearer multi-turn conversation rendering, and a trajectory view for agent activity with tool call and result details.

For more information, see [Observability]({{< link-hextra path="/observability/" >}}) and the [`agctl proxy profile`]({{< link-hextra path="/reference/agctl/agctl-proxy-profile/" >}}) reference.

#### Status and resource reporting

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2794 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3034 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3116 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3101 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2998 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2699 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2907 -->

- `AgentgatewayModel` reports status, and the controller writes `InferencePool` status for pools that a model references. Redundant `InferencePool` status writes are suppressed.
- A failure to write a deployed object is reported in status rather than only logged.
- A policy that targets a missing `sectionName` is surfaced in status.
- Conflicts on an internal `Gateway` or `ListenerSet` are handled correctly.
- `AgentgatewayModel` appears in the configuration dump, so `agctl` can inspect it.

For more information, see [Debug the gateway]({{< link-hextra path="/operations/debug/" >}}).

#### Deployment and operations

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2739 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3052 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2972 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2737 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2909 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3099 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2950 -->

- **ListenerSet postrouting policies**: The proxy applies postrouting policies that a `ListenerSet` attaches, which the controller already translated.
- **Custom xDS request headers**: Set `XDS_HEADER_*` environment variables on the proxy to attach operator-defined headers, such as `x-istio-revision` or a tenant identifier, to outbound xDS requests. The headers are validated at startup.
- **Controller chart values**: The controller Helm chart adds `controller.revisionHistoryLimit` and `dnsConfig`.
- **Pluggable cryptography**: A `crypto` module centralizes random number generation, authenticated encryption with associated data (AEAD), digest, JWT, and TLS provider selection behind `crypto-*` build flags. A SymCrypt provider is available for builds that need it. AWS-LC remains the default.
- **Shared duration type**: Duration fields across the CRDs use one shared type, which simplifies their validation rules.
- **Request tracing**: The `agctl` trace view no longer exits when output is truncated.

For the chart values, see the [Helm reference]({{< link-hextra path="/reference/helm/" >}}).

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

**Operations**

- A negative duration is clamped to zero instead of being rejected, and upstream connect duration is recorded at full precision.
- The admin UI analytics summary no longer loops its request.
- The controller validates with CEL that a port is a number.

For the complete list of fixes, see the [GitHub release notes](https://github.com/agentgateway/agentgateway/releases).
