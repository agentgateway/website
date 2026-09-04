---
title: Release notes
weight: 20
description: What's new, changed, and fixed in each agentgateway standalone release.
test: skip
---

Review the release notes for agentgateway standalone.

> [!NOTE]
> For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).

## ✨ Highlights {#v15-highlights}

Version 1.5 focuses on LLM cost control, native provider API surfaces, and outbound traffic.

- **[API key budgets and model access](#v15-apikey-budgets)**: Cap the LLM spend of an individual API key in dollars or tokens, and limit which models the key can reach.
- **[Native Gemini inbound API](#v15-gemini-inbound)**: Clients that are built on the Gemini and Vertex AI SDKs can call agentgateway in Gemini's native wire format.
- **[Anthropic Messages to OpenAI Responses conversion](#v15-anthropic-responses)**: Send a client that speaks the Anthropic Messages API to a provider that advertises only the Responses format.
- **[Egress proxying, TCP backends, and CONNECT tunneling](#v15-egress)**: Run agentgateway as an egress proxy for agent workloads.
- **[Rebuilt logs and trajectory views](#v15-ui)**: Inspect multi-turn agent activity, tool calls, and results in the admin UI.

## 🔥 Breaking changes {#v15-breaking-changes}

### LLM input and total token counts include cache tokens

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2880 -->

LLM providers disagree about whether the input token count in a response includes the tokens that the provider read from or wrote to its prompt cache. Anthropic and Amazon Bedrock exclude cached tokens. OpenAI, Azure OpenAI, and Google Gemini include them. Agentgateway used to pass each provider's number through unchanged, so the same prompt produced a different count depending on which provider served it. Agentgateway now normalizes the counts so that they mean the same thing for every provider.

- `llm.inputTokens` is the total input count, including cache-read and cache-creation tokens.
- `llm.totalTokens` is the normalized input count plus the output count.
- `llm.providerInputTokens` and `llm.providerTotalTokens` are new fields that report the counts exactly as the provider sent them.

The `llm.cachedInputTokens` and `llm.cacheCreationInputTokens` fields do not change, and both are now always a subset of `llm.inputTokens`. Only the providers that previously excluded cached tokens report different values. Those providers are Anthropic, Amazon Bedrock, Anthropic models served through Vertex AI or GitHub Copilot, and custom providers that use the `messages` or `anthropicTokenCount` format. Cost tracking does not change, because the model cost catalog already priced cached tokens separately.

**Actions to take**: The normalized counts reach every feature that reads a token count, including access logs, spans, metrics, token-based rate limits, and CEL expressions. To read the provider's unmodified value instead, use `llm.providerInputTokens` or `llm.providerTotalTokens`. Review each token-based rate limit that you sized against a provider that excluded cached tokens, because requests now consume the limit sooner. Annotate the upgrade in any dashboard that trends input tokens.

To restore the previous behavior while you migrate, set the `AGENTGATEWAY_LEGACY_LLM_USAGE_TOKEN_SEMANTICS` environment variable to `true` for the agentgateway process. Agentgateway plans to remove this variable after version 1.5, so treat it as a short-term migration aid.

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

**Actions to take**: Confirm that your identity provider issues an `iss` claim in the tokens that reach agentgateway. Most providers do. If you accept tokens that have no `aud` claim, remove `audiences` from the policy or set it to an empty list, because a non-empty list now rejects those tokens. For the policy fields, see [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}).

### AI policies on a backend merge with an attached policy

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2821 -->

An AI policy set directly on a backend used to replace an attached AI policy in full. If the backend set even one field, every field of the attached policy was dropped, including prompt guards, prompt enrichment, defaults, transformations, model aliases, and prompt caching. The two policies now merge field by field, and the backend's value wins for a field that both of them set.

**Actions to take**: Review each backend that sets an `ai` policy alongside an attached AI policy. A field that the attached policy sets, and the backend does not, now takes effect where it was previously ignored. Remove any field from the attached policy that you do not want the backend to inherit.

### A listener that cannot bind now fails startup

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2588 -->

When you start agentgateway with a static configuration file, a listener that cannot open its socket used to log a warning and leave the process running. A port that was already in use therefore looked like a healthy start. Agentgateway now exits with a non-zero status and reports the bind error. Configuration reloads and listeners that arrive over xDS keep the previous behavior, so a failed reload keeps the last good configuration instead of stopping the process.

**Actions to take**: A port conflict that used to be silent now stops the process, and a supervisor that restarts agentgateway on exit turns it into a crash loop. Free the port or change the `bind` address in your configuration.

### Managed API key metadata uses the reserved `agentgateway.dev/` prefix

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3139 -->

API keys that you create in the admin UI or through the admin API carry metadata that agentgateway manages. That metadata moved to a reserved prefix so that agentgateway can add server-side fields, such as authenticated user information, without colliding with your own metadata.

- The key identifier moved from `metadata.id` to `metadata["agentgateway.dev/id"]`.
- A new `metadata["agentgateway.dev/createdAt"]` field records when the key was created.
- Any metadata field that you supply with the `agentgateway.dev/` prefix is now rejected.

**Actions to take**: Update any script or integration that reads `metadata.id` from an `llm.apiKey` resource. If your own key metadata uses the `agentgateway.dev/` prefix, rename those fields before you upgrade. For more information, see [API key authentication]({{< link-hextra path="/configuration/security/apikey-authn/" >}}).

## ⚠️ Removed or deprecated {#v15-removed-deprecated}

### The `MODEL_CATALOG_PATHS` environment variable is removed

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2772 -->

Agentgateway no longer reads the `MODEL_CATALOG_PATHS` environment variable. The variable could not be reconciled with dynamic configuration reloading, and the same catalog sources can be set in the configuration file instead.

**Actions to take**: Move each path from the environment variable to the `config.modelCatalog` list in your configuration file, as in the following example. Agentgateway silently ignores the environment variable, so a catalog that you load this way stops being applied after you upgrade.

```yaml
config:
  modelCatalog:
  - file: /etc/agentgateway/model-catalog/costs.json
```

For the catalog fields, see the [Configuration reference]({{< link-hextra path="/reference/configuration/" >}}).

### The `agctl costs` command is renamed to `agctl catalog`

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2927 -->

The `agctl` command that manages model catalogs is renamed from `agctl costs` to `agctl catalog`, because a catalog entry now carries more than pricing data. The subcommand and its flags do not change, and the command produces the same catalog JSON. The `agctl costs` command still runs the same code, but it is deprecated and reports that you must use `agctl catalog` instead. Agentgateway plans to remove `agctl costs` in a future release.

**Actions to take**: Replace `agctl costs` with `agctl catalog` in any script or pipeline that generates a model catalog. For the flags and examples, see the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference.

## 🌟 New features {#v15-new-features}

### LLM {#v15-features-llm}

#### API key budgets and model access {#v15-apikey-budgets}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3143 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3107 -->

An API key entry now takes a `budgets` list that caps LLM spend for that key, and an `allowedModels` list that limits which models the key can reach. A budget has a name, a limit in `USD` or `Tokens`, a rolling window, and an action to take when the key exceeds the limit. The `Block` action rejects the request, and the `Audit` action records the overage and lets the request through.

```yaml
policies:
  apiKey:
    keys:
    - key: "$TEAM_A_KEY"
      allowedModels:
      - "gpt-5*"
      - claude-sonnet-5
      budgets:
      - name: daily-spend
        limit:
          unit: USD
          amount: 50
        window:
          rolling: 24h
        onBudgetExceeded: Block
```

Windows align to the Unix epoch rather than to the first request, so `1h` follows UTC clock hours and `24h` starts at midnight UTC. Usage is charged after the LLM response, from the tokens or cost that the provider reports. A provider that does not report the unit that the budget needs is logged but cannot be charged or blocked after the fact. Budget state is held in memory and flushed to the database every five seconds, which keeps the database off the request path. A burst of traffic across replicas can therefore overshoot the limit.

Budgets depend on a database, so they require the `hybrid` storage mode and are available in standalone mode only. Omit `allowedModels` to leave a key unconstrained, and set an empty list to deny every model. Both fields work with `key` and `keyHash` entries, and you can manage budgets in the admin UI.

For the storage requirement, see [Store config in a database]({{< link-hextra path="/setup/storage/" >}}), and for key configuration, see [API key authentication]({{< link-hextra path="/configuration/security/apikey-authn/" >}}).

#### Native Gemini inbound API {#v15-gemini-inbound}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2963 -->

Clients that are built on the Gemini or Vertex AI SDKs can now call agentgateway in Gemini's native wire format, rather than through an OpenAI-compatible endpoint. Two route types are added, and by default agentgateway maps paths to them automatically.

| Route type | Default paths |
| --- | --- |
| `generateContent` | Paths that end in `:generateContent` or `:streamGenerateContent` |
| `geminiCountTokens` | Paths that end in `:countTokens` |

The model comes from the `models/{model}` path segment, so any `gemini-*` model works without per-model configuration. Streaming requires `alt=sse`, because Gemini's default JSON-array streaming mode is not supported. Prompt guards apply to `generateContent` and `streamGenerateContent`, and are skipped for `countTokens`. A Gemini request to a non-Gemini provider returns an explicit unsupported-conversion error.

For the supported API types, see [LLM API types]({{< link-hextra path="/llm/api-types/" >}}).

#### Anthropic Messages to OpenAI Responses conversion {#v15-anthropic-responses}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2689 -->

Agentgateway can now translate an Anthropic Messages request into an OpenAI Responses request, and translate the buffered or streamed reply back into the Messages format. Use it when a client sends `/v1/messages` but the provider that you route to advertises only the Responses format. The existing Messages-to-Completions path still takes precedence for providers that advertise both formats, so dual-format OpenAI and Azure OpenAI providers are unchanged.

For the supported formats, see [LLM API types]({{< link-hextra path="/llm/api-types/" >}}).

#### OpenAI inline moderation

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2519 -->

An OpenAI provider can now carry a `moderation` block that agentgateway injects into chat completions and Responses requests, so that OpenAI moderates the request inline rather than in a separate call. The gateway sets the configuration, which means a client cannot turn moderation off or weaken it. You choose a moderation model and set `block` or `score` mode independently for input and output.

```yaml
llm:
  models:
  - name: "*"
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

This is separate from the existing `openAIModeration` prompt guard, which calls the Moderation API from the gateway. For that approach, see [OpenAI moderation]({{< link-hextra path="/llm/prompt-guards/moderation/" >}}).

#### Prompt guards can scan tool input and output

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3000 -->

A prompt guard now takes an optional `scope` list that selects which parts of an LLM request it inspects. The accepted values are `systemPrompt`, `messages`, `toolOutput`, and `toolInput`. Tool content is opt in, so a guard without a `scope` behaves as it did before. Scoping is currently supported by the regex guard.

For the field, the caveats on masking opaque tool arguments, and examples, see [Prompt guards]({{< link-hextra path="/llm/prompt-guards/regex/" >}}).

#### Transformations after provider conversion

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2912 -->

Transformations run before agentgateway converts a request into the provider's format, so writing one meant understanding how that conversion works, and fields that the conversion adds could not be changed at all. A new `finalTransformation` field on a model, and a `finalTransformations` field on an AI policy, run after the conversion instead. You only need to know the shape of the target API.

```yaml
llm:
  models:
  - name: gpt-5.6-luna
    provider:
      reference: azure-provider
    params:
      model: gpt-5.6-luna
    finalTransformation:
      reasoning_effort: 'fail("remove")'
      max_tokens: '600'
```

For more information, see [Transformations]({{< link-hextra path="/llm/transformations/" >}}).

#### Other LLM improvements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2927 -->
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

- **Catalog tags**: A catalog entry carries a freeform `tags` list alongside its pricing rates and tiers, which is why `agctl costs` became `agctl catalog`. Use tags to record capability or routing information about a model and to select models in policies. The initial catalog refresh at startup is also fixed.
- **Bedrock**: Amazon Nova multimodal embeddings and Cohere v4 embeddings are supported. This release also corrects `top_k` translation, handles image URLs consistently across input types, and mutates a guardrail payload in place so that the original structure is preserved.
- **GitHub Copilot and DeepSeek**: Grok models are routed through the Responses API, and the DeepSeek preset advertises the Responses format.
- **Prompt caching across formats**: OpenAI cache markers are translated into their Anthropic and Bedrock equivalents.
- **Vertex AI embeddings**: `gemini-embedding-2` and later models are routed to the `:embedContent` endpoint, because Google no longer serves `:predict` for them. The `gemini-embedding-001` and `text-embedding-*` models stay on `:predict`. Because `:embedContent` embeds one input per call, a multi-input array now returns an explicit error instead of collapsing into a single vector.
- **Token counting**: The count-tokens endpoint is routed by default, and an Anthropic thinking budget is capped by the request's maximum token count.
- **Guardrail refactor**: Guardrails are restructured internally, and prompt guard logs record which pattern matched.
- **Error handling**: Proxy errors are classified by the phase they occurred in, and the original upstream HTTP status code is preserved on an error response.

For the list of supported providers, see the [LLM providers]({{< link-hextra path="/llm/providers/" >}}) docs, and for the command, see [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}).

### Security {#v15-features-security}

#### Signed JWT backend authentication

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2515 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2849 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2763 -->

A new `backendAuth.jwtSign` method signs a JSON Web Token per request with a private key that you supply, and attaches it to the backend request. Use it for upstreams that require a keypair-signed JWT rather than a static credential, such as the Snowflake SQL API. Claim values accept CEL expressions, and a signing key that you reference by file path is reloaded when the file changes, so a key rotation does not require a restart.

For the signing key, key ID, token lifetime, claims, placement, and supported algorithms, see [Signed JWT]({{< link-hextra path="/configuration/security/backend-authn/jwt-sign/" >}}).

#### Connection-level external authorization

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3016 -->

A new `networkExtAuthz` frontend policy calls an external authorization service once for each downstream connection, instead of once for each HTTP request. Use it to authorize a whole connection, including TCP traffic that carries no HTTP requests, and to avoid a per-request callout on a long-lived connection. It takes the same fields as the existing `extAuthz` policy, except that it calls the service over HTTP only. Set `protocol.http` explicitly, because the field defaults to `grpc` and agentgateway rejects a `networkExtAuthz` policy that uses it.

For per-request authorization and the new policy, see [External authorization]({{< link-hextra path="/configuration/security/external-authz/#network-extauthz" >}}).

#### Cross App Access and token exchange enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2770 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2750 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2892 -->

- **Separate scopes per leg**: Cross App Access takes a new `accessTokenScopes` field, which sets the scopes for the access-token exchange independently of the scopes that request the OAuth Identity Assertion Authorization Grant (ID-JAG). Omit the field to inherit `scopes`. Set an empty list to omit the `scope` parameter entirely, which some authorization servers require, such as an Okta custom authorization server.
- **Configurable subject token type**: Cross App Access takes `subjectToken.tokenType`, so a workload identity that authenticates with client credentials can exchange an access token. The default is still `id_token`.
- **Optional `requested_token_type`**: The parameter is optional in OAuth token exchange, which matches [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693).

For more information, see [Cross App Access]({{< link-hextra path="/configuration/security/backend-authn/cross-app-access/" >}}) and [OAuth token exchange]({{< link-hextra path="/configuration/security/backend-authn/oauth-token-exchange/" >}}).

#### Sensitive request header redaction

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3078 -->

A new `config.sensitiveHeaders` list names request headers whose values must not appear in trace or debug output. Agentgateway marks the headers as sensitive when the request arrives and re-marks them after request and backend CEL transformations, so a header that a transformation creates is also redacted. The real values are still forwarded upstream and are still available to CEL.

For more information, see [Debug requests]({{< link-hextra path="/operations/trace-requests/" >}}).

#### Other security improvements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2640 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3106 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3022 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3144 -->

- **SPIFFE Workload API identity**: Set `config.spiffe.endpoint` to a local SPIFFE Workload API socket, such as a SPIRE agent. Agentgateway then sources the mTLS identity and trust bundle from it instead of from a static certificate and key on disk. The X.509 SPIFFE Verifiable Identity Document (SVID) rotates without a restart. Listeners and backends then opt in individually with `tls.spiffe` and `backendTLS.spiffe`, and `backendTLS.subjectAltNames` verifies the upstream SPIFFE ID. The peer identity is available to policies as the `source.spiffeId` CEL attribute. For the fields, see the [Configuration reference]({{< link-hextra path="/reference/configuration/" >}}) and the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).
- **Preserve a validated JWT**: A JWT policy takes a `preserveToken` field. Set it to `true` to keep a successfully validated JWT in the location that it arrived in, so that a backend can read the original token. The default is `false`, which removes the token after validation, as earlier releases did.
- **DNS rebinding protection for MCP backends**: Set `dnsRebindingProtection` on an MCP backend to reject requests whose `Host` or `Origin` header does not name a loopback address, which blocks DNS rebinding attacks against a locally bound MCP server. Protection is off by default. For the accepted hosts and an example, see [Connect to an MCP server over HTTP]({{< link-hextra path="/mcp/connect/http/" >}}).
- **Client endpoint headers are stripped for inference routing**: The `x-gateway-destination-endpoint` header is an output of the endpoint picker, not an input that a client sets. Agentgateway now removes it from an incoming request before [inference routing]({{< link-hextra path="/inference/" >}}) runs. No action is needed, because the header was already overwritten in most paths.

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

#### Egress proxying, TCP backends, and CONNECT tunneling {#v15-egress}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3013 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3095 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3014 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3124 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3098 -->

This release fills in the pieces that agentgateway needs to serve as an egress proxy for agent workloads.

- **Dynamic backends for TCP**: A TCP route can use a dynamic backend, so the destination comes from the connection rather than from static configuration.
- **CEL target selection**: A dynamic backend takes an optional `target` CEL expression that computes the `host:port` to dial. Use it to read a destination that external processing returned in `extproc.*` metadata, instead of having external processing rewrite the request authority. Omit `target` to keep dialing the destination that the request names. For an example, see [External processing]({{< link-hextra path="/configuration/traffic-management/extproc/" >}}).
- **Tunnel mode**: The `backendTunnel` policy takes a `mode` field. The default `auto` mode uses `CONNECT` for TLS and non-HTTP transports, and absolute-form requests for plaintext HTTP. The `connect` mode uses `CONNECT` for everything. You can also attach policies to the connection with the tunnel proxy itself, and `CONNECT` requests can be tunneled through a dynamic proxy backend.
- **Forward proxy authentication**: A client can authenticate with the `Proxy-Authorization` header instead of `Authorization`. Agentgateway reads the credential from that header, strips it before the request goes upstream, and marks it sensitive so that its value is not logged. A failed `CONNECT` authentication returns a `407` response with a `Proxy-Authenticate` header, as the HTTP specification requires.
- **Backend connection timeouts**: A backend can set `connectTimeout`, the `keepalives` settings, and the connection pool settings. The `requestTimeout` field sets the deadline for a response.

For a worked example, see the [`traffic-egress-proxy` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-egress-proxy) in the agentgateway repository, and for the timeout fields, see [Timeouts]({{< link-hextra path="/configuration/resiliency/timeouts/" >}}).

#### Session affinity

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2779 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2825 -->

A new `sessionAffinity` backend policy pins requests that share an affinity value to the same endpoint, without any state shared between agentgateway replicas. A `source` CEL expression extracts the value, which is hashed and mapped to an endpoint by weighted rendezvous hashing, so every replica independently picks the same backend. Affinity is best-effort and applies only when no explicit inference or MCP destination exists.

For the fields, the fallback behavior, common expressions, and examples, see [Session affinity]({{< link-hextra path="/configuration/backends/#session-affinity" >}}).

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

#### Admin UI enhancements {#v15-ui}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2888 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3148 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3149 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2683 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3138 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2986 -->

- A redesigned logs view and conversation view.
- A trajectory view for multi-turn agent activity, with tool call and result details.
- The UI follows your system theme by default.
- The CEL playground works when the UI is exposed through a gateway.
- The LLM playground forwards its API key to MCP requests.

For more information, see [Admin UI]({{< link-hextra path="/setup/ui/" >}}).

#### Observability enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3079 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3027 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3068 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3100 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2920 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2925 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3141 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2110 -->

- **Native histograms**: A new `config.histograms` field chooses which histogram representation to collect: `classic`, `native`, or `both`. Native histograms are exposed only through the Prometheus protobuf format. The default is `classic`, because native histograms add scrape overhead.
- **Protobuf metrics**: The `/metrics` and `/stats/prometheus` endpoints negotiate the response format from the `Accept` header, so a scraper that asks for `application/vnd.google.protobuf` gets protobuf instead of text.
- **Spans for every policy call**: Tracing emits an outbound span for the upstream call and for each policy callout, such as external authorization or a guardrail webhook. MCP and gRPC spans are named with protocol-specific information, and request tracing with `agctl` follows the same outbound calls.
- **Explicit LLM payload logging**: Logging an LLM prompt or completion is now an explicit setting rather than a side effect of a CEL expression. Set `frontendPolicies.accessLog.database.llm` to `metadata` to store usage, timing, and cost without content, or to `full` to also store prompt and completion content. For more information, see [Log to a database]({{< link-hextra path="/observability/access-logs/database/" >}}).
- **LLM token timing in access logs**: Access logs record time-to-first-token and related timing for LLM requests.
- **CPU and heap profiles**: A new `agctl proxy profile` command collects pprof CPU and heap profiles from the admin endpoint.
- **Generated metrics reference**: The metrics documentation is generated from the schema, so it stays in step with the code.

For more information, see [Observability]({{< link-hextra path="/observability/" >}}) and the [`agctl proxy profile`]({{< link-hextra path="/reference/agctl/agctl-proxy-profile/" >}}) reference.

#### Read-only configuration storage

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2988 -->

A new `readOnly` value for `config.storage.mode` locks the admin UI and the admin API to reads. Every handler that mutates state returns a `403` response, including configuration file writes, resource create and delete, and a model catalog refresh. Read-only endpoints such as the CEL playground, the logs API, and every `GET` are unaffected, and the UI shows a banner and blocks the same write paths before it calls the API. You can also set the `UI_READ_ONLY` environment variable to `true`.

If you deploy the standalone Helm chart, its `mode: readonly` value already serves configuration from a read-only ConfigMap. For the storage modes, see [Store config in a database]({{< link-hextra path="/setup/storage/" >}}).

#### Other operations improvements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2915 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2797 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3132 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2823 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2844 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2737 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2909 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3099 -->

- **LiteLLM import**: The `agctl` importer now handles wildcard model names, including `*` and prefix and suffix wildcards, and imports LiteLLM centralized credentials from `credential_list` and `litellm_credential_name` as reusable providers and provider references. It reports an explicit finding for a wildcard or credential that agentgateway cannot represent safely. For more information, see [Import a configuration]({{< link-hextra path="/configuration/import/" >}}).
- **Backend credential rotation**: A `backendAuth.key` that points at a file is reloaded when the file changes, so rotating a token no longer requires a restart or an unrelated configuration edit. The `backendTLS` and `jwtSign` key fields already behaved this way.
- **Pod labels in the standalone Helm chart**: The chart can label the agentgateway pod, which platforms such as Azure workload identity require. For the chart values, see [Install with Helm]({{< link-hextra path="/setup/install/helm/" >}}).
- **XDG config directory**: Agentgateway respects `XDG_CONFIG_HOME` when it looks for local configuration.
- **Pluggable cryptography**: A `crypto` module centralizes random number generation, authenticated encryption with associated data (AEAD), digest, JWT, and TLS provider selection behind `crypto-*` build flags. A SymCrypt provider is available for builds that need it. AWS-LC remains the default.

## 🐛 Fixes {#v15-fixes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3017 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2735 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3103 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2964 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2775 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2846 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2991 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3007 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2983 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3073 -->
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
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3048 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3140 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2661 -->

**Security**

- An invalid inline JWKS reports an error, and an invalid JWT produces a clearer message.
- A file-mode `apiKey` policy keeps its keys when the field is omitted on an upsert.

**MCP and A2A**

- A2A interface URL rewriting is correct when a path rewrite policy is active, and A2A v1.0 nested payloads record response telemetry and the context ID.

**LLM**

- Bedrock virtual models no longer bypass the transformed model on the upstream path, and Bedrock streaming indexes, invalid function inputs, and image URL handling are fixed.
- Gemini usage is extracted from the Cloud Code `response` envelope, and parallel tool calls are preserved across the Gemini and Completions conversions.
- Anthropic streaming sets the role on the first delta, honors the final input usage, and no longer fails the whole request when a server tool errors.
- A multi-turn request whose previous turn returned empty tool arguments no longer fails validation.

**Traffic management**

- The `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset` headers are now returned on every rate-limited response, for both local and remote rate limiting, rather than only on some paths. Clients that back off based on those headers behave correctly when an LLM token limit is what rejected the request. For the headers, see [Rate limits]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}).
- Listener port swaps are reconciled dynamically, and a bind that transitions to an internal bind is stopped.
- Invalid header modifications are rejected, and route policy application is more consistent.

**Operations**

- A negative duration is clamped to zero instead of being rejected, and upstream connect duration is recorded at full precision.
- The admin UI analytics summary no longer loops its request.

For the complete list of fixes, see the [GitHub release notes](https://github.com/agentgateway/agentgateway/releases).
