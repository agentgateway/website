---
title: Release notes
weight: 20
description: What's new, changed, and fixed in each agentgateway standalone release.
test: skip
---

Review the release notes for agentgateway standalone.

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

To restore the previous behavior while you migrate, set the `AGENTGATEWAY_LEGACY_LLM_USAGE_TOKEN_SEMANTICS` environment variable to `true` for the agentgateway process. Agentgateway plans to remove this variable after version 1.5, so treat it as a short-term migration aid and not as a supported configuration.

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

**Actions to take**: Confirm that your identity provider issues an `iss` claim in the tokens that reach agentgateway. Most providers do. If you accept tokens that have no `aud` claim, remove `audiences` from the policy or set it to an empty list, because a non-empty list now rejects those tokens. For the policy fields, see [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}).

### AI policies on a backend merge with an attached policy

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2821 -->

An AI policy set directly on a backend used to replace an attached AI policy in full. If the backend set even one field, every field of the attached policy was dropped, including prompt guards, prompt enrichment, defaults, transformations, model aliases, and prompt caching. The two policies now merge field by field, and the backend's value wins for a field that both of them set.

**Actions to take**: Review each backend that sets an `ai` policy alongside an attached AI policy. A field that the attached policy sets, and the backend does not, now takes effect where it was previously ignored. Remove any field from the attached policy that you do not want the backend to inherit.

### A listener that cannot bind now fails startup

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2588 -->

When you start agentgateway with a static configuration file, a listener that cannot open its socket used to log a warning and leave the process running. A port that was already in use therefore looked like a healthy start, with nothing served on that address. Agentgateway now exits with a non-zero status and reports the bind error.

Configuration reloads and listeners that arrive over xDS keep the previous behavior. A reload that fails to bind keeps the last good configuration instead of stopping the process.

**Actions to take**: A port conflict that used to be silent now stops the process. If a supervisor or container restarts agentgateway on exit, the conflict shows up as a crash loop, with the bind error in the logs. Free the port or change the `bind` address in your configuration.

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

The `agctl` command that manages model catalogs is renamed from `agctl costs` to `agctl catalog`, because a catalog entry now carries more than pricing data. The subcommand and its flags do not change: `agctl catalog import` takes the same `--source`, `--providers`, `--legacy`, `--pretty`, and `--out` flags that `agctl costs import` took, and it produces the same catalog JSON.

The `agctl costs` command still runs the same code, but it is deprecated and reports that you must use `agctl catalog` instead. Agentgateway plans to remove `agctl costs` in a future release.

**Actions to take**: Replace `agctl costs` with `agctl catalog` in any script or pipeline that generates a model catalog. For the flags and examples, see the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference.

## 🌟 New features {#v15-new-features}

Version 1.5 adds SPIFFE workload identity, native Gemini and Anthropic API surfaces, per-API-key LLM budgets, and an egress mode for outbound traffic. Guardrails, rate limiting, CEL, and observability each gain new options.

### Security {#v15-features-security}

#### mTLS identity from the SPIFFE Workload API

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2640 -->

Agentgateway can source its mTLS identity from a local SPIFFE Workload API, such as a SPIRE agent, instead of from a static certificate and key on disk. Set the `config.spiffe.endpoint` field to the Workload API socket, for example `unix:///run/spire/agent.sock`. Agentgateway then keeps the X.509 SPIFFE Verifiable Identity Document (SVID) and the trust bundle current in the background, and rotates them without a restart.

After the endpoint is set, listeners and backends opt in individually.

- Set `tls.spiffe` on an HTTPS listener to terminate TLS with the SPIFFE-issued SVID. Inbound mTLS is mandatory in this mode, and the client certificate is verified against the gateway's own trust domain bundle.
- Set `backendTLS.spiffe` on a backend to use the same identity for outbound mTLS. Add `backendTLS.subjectAltNames` to also verify the upstream SPIFFE ID.

The peer's raw SPIFFE ID is available to policies through the `source.spiffeId` CEL attribute. When `config.spiffe` is not set, SPIFFE is disabled and nothing changes.

Because SPIFFE support is new in this release, it is not yet covered by a dedicated guide. For the fields available today, see the [Configuration reference]({{< link-hextra path="/reference/configuration/" >}}), and for the new CEL attribute, see the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).

#### Signed JWT backend authentication

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2515 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2849 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2763 -->

A new `backendAuth.jwtSign` method signs a JSON Web Token per request with a private key that you supply, and attaches it to the backend request. Use it for upstreams that require a keypair-signed JWT rather than a static credential, such as the Snowflake SQL API. You configure the signing key, an optional key ID, the token lifetime, the claims to sign, and where to place the token on the request. The supported signing algorithms are `RS256`, `RS384`, `RS512`, `PS256`, `ES256`, and `ES384`. Claim values accept CEL expressions, so you can derive a claim from the incoming request.

A signing key that you reference by file path is reloaded when the file changes, so a key rotation does not require a restart.

For more information, see [Signed JWT]({{< link-hextra path="/configuration/security/backend-authn/#signed-jwt" >}}).

#### JWT validation can preserve the original token

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3106 -->

A JWT policy now takes a `preserveToken` field. Set it to `true` to keep a successfully validated JWT in the location that it arrived in, so that a backend can read the original token. The default is `false`, which removes the token after validation, as earlier releases did.

For the policy fields, see [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}).

#### Connection-level external authorization

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3016 -->

A new `networkExtAuthz` frontend policy calls an external authorization service once for each downstream connection, instead of once for each HTTP request. Use it to authorize a whole connection, including TCP traffic that carries no HTTP requests, and to avoid a per-request callout on a long-lived connection. It takes the same configuration as the existing `extAuthz` policy.

For per-request authorization, keep using [External authorization]({{< link-hextra path="/configuration/security/external-authz/" >}}). For the new field, see the [Configuration reference]({{< link-hextra path="/reference/configuration/" >}}).

#### Cross App Access and token exchange enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2770 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2750 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2892 -->

- **Separate scopes per leg**: Cross App Access takes a new `accessTokenScopes` field. The field sets the scopes for the access-token exchange independently of the scopes that request the OAuth Identity Assertion Authorization Grant (ID-JAG). Omit the field to inherit `scopes`, which preserves the current behavior. Set an empty list to omit the `scope` parameter entirely, which some authorization servers require, such as an Okta custom authorization server.
- **Configurable subject token type**: Cross App Access takes `subjectToken.tokenType`, so a workload identity that authenticates with client credentials can exchange an access token. The default is still `id_token`.
- **Optional `requested_token_type`**: The parameter is optional in OAuth token exchange, which matches [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693).

For more information, see [Cross App Access]({{< link-hextra path="/configuration/security/backend-authn/cross-app-access/" >}}) and [OAuth token exchange]({{< link-hextra path="/configuration/security/backend-authn/oauth-token-exchange/" >}}).

#### Sensitive request header redaction

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3078 -->

A new `config.sensitiveHeaders` list names request headers whose values must not appear in trace or debug output. Agentgateway marks the headers as sensitive when the request arrives and re-marks them after request and backend CEL transformations, so a header that a transformation creates is also redacted. The real values are still forwarded upstream and are still available to CEL.

```yaml
config:
  sensitiveHeaders:
  - authorization
  - my-mcp-token
```

For more information, see [Debug requests]({{< link-hextra path="/operations/trace-requests/" >}}).

#### Inference routing ignores a client-supplied endpoint header

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3144 -->

The `x-gateway-destination-endpoint` header names the model server endpoint that an inference request is sent to. The header is an output of the endpoint picker, not an input that a client is allowed to set. Agentgateway now strips the header from an incoming request before inference routing runs, so a client can no longer choose its own model server endpoint by setting the header.

No action is needed. If a client sets the header today, it was already being overwritten in most paths, and it is now removed in all of them. For more information, see [Inference routing]({{< link-hextra path="/inference/" >}}).

#### DNS rebinding protection for MCP backends

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3022 -->

An MCP backend can now reject requests whose `Host` or `Origin` header does not name a loopback address, which blocks DNS rebinding attacks against a locally bound MCP server. Set `dnsRebindingProtection` on the MCP backend to turn it on. When it is on, agentgateway accepts only `localhost`, `127.0.0.1`, and `[::1]`, with an optional port, and returns a `403` response for anything else.

Protection is off by default, so a gateway that fronts remote clients is unchanged. Turn it on when agentgateway and the MCP server both run on a developer machine. For the field, see the [Configuration reference]({{< link-hextra path="/reference/configuration/" >}}).

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

#### API key budgets and model access

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3143 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3107 -->

An API key entry now takes a `budgets` list that caps LLM spend for that key. It also takes an `allowedModels` list that limits which models the key can reach.

A budget has a name, a limit in `USD` or `Tokens`, a fixed window that you set with `window.rolling`, and an action to take when the key exceeds the limit. The `Block` action rejects the request with a `429` response. The `Audit` action records the overage and lets the request through. Windows align to the Unix epoch rather than to the first request, so `1h` follows UTC clock hours and `24h` starts at midnight UTC.

```yaml
config:
  database:
    url: sqlite://budgets.db
llm:
  policies:
    apiKey:
      keys:
      - key: "$TEAM_A_KEY"
        metadata:
          name: team-a
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
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

Budgets are available in standalone mode only, and they have two requirements that agentgateway enforces at startup. The configuration must set `config.database.url`, because budget counts live in a database. Every key that carries a budget must set `metadata.name`, which identifies the key in budget counts, logs, and the admin API. Neither requirement applies to `allowedModels`, which you can use on its own. Omit `allowedModels` to leave a key unconstrained, and set an empty list to deny every model. Both fields work with `key` and `keyHash` entries.

Agentgateway charges usage after the LLM response returns, from the tokens or cost that the provider reports. When the provider does not report the unit that a budget needs, agentgateway logs the request but cannot charge or reject it after the fact. A `USD` budget therefore charges nothing until a model cost catalog prices the models that the key uses, and agentgateway reports no error while the budget stays at zero.

Because charging happens after the response, the request that crosses the limit always completes, and a single replica overshoots by that request. Agentgateway holds budget state in memory and flushes it to the database every five seconds, which keeps the database off the request path. Several replicas therefore increase the overshoot further. You can view and manage budgets in the [Admin UI]({{< link-hextra path="/setup/ui/" >}}).

For more information, see [Per-key dollar or token budgets]({{< link-hextra path="/llm/cost-controls/budget-limits/per-key/" >}}), [API key authentication]({{< link-hextra path="/configuration/security/apikey-authn/" >}}), and [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).

#### Native Gemini inbound API

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2963 -->

Clients that are built on the Gemini or Vertex AI SDKs can now call agentgateway in Gemini's native wire format, rather than through an OpenAI-compatible endpoint. Two route types are added, and by default agentgateway maps paths to them automatically.

| Route type | Default paths |
| --- | --- |
| `generateContent` | Paths that end in `:generateContent` or `:streamGenerateContent` |
| `geminiCountTokens` | Paths that end in `:countTokens` |

The model comes from the `models/{model}` path segment, so any `gemini-*` model works without per-model configuration. Streaming requires `alt=sse`. Gemini's default JSON-array streaming mode is not supported. Prompt guards apply to `generateContent` and `streamGenerateContent`, and are skipped for `countTokens`. Thinking configuration and returned thought parts pass through unchanged.

Native Gemini input targets Gemini-family backends. A Gemini request to a non-Gemini provider returns an explicit unsupported-conversion error. For the supported API types, see [LLM API types]({{< link-hextra path="/llm/api-types/" >}}).

#### Anthropic Messages to OpenAI Responses conversion

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2689 -->

Agentgateway can now translate an Anthropic Messages request into an OpenAI Responses request, and translate the buffered or streamed reply back into the Messages format. Use it when a client sends `/v1/messages` but the provider that you route to advertises only the Responses format.

The existing Messages-to-Completions path still takes precedence for providers that advertise both formats, so dual-format OpenAI and Azure OpenAI providers are unchanged. The conversion covers a common agent subset, including text, system instructions, image inputs by URL, base64 data, or file ID, tool calls, and streaming. For more information, see [LLM API types]({{< link-hextra path="/llm/api-types/" >}}).

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

A prompt guard now takes an optional `scope` list that selects which parts of an LLM request it inspects. The accepted values are `systemPrompt`, `messages`, `toolOutput`, and `toolInput`. Tool content is opt in, so a guard without a `scope` behaves as it did before.

```yaml
promptGuard:
  request:
  - scope: [toolOutput]
    regex:
      action: mask
      rules:
      - builtin: ssn
```

Scoping is currently supported by the regex guard. In APIs that send tool arguments as opaque JSON, such as Completions, `toolInput` arguments are treated as a single string, so a masking rule can rewrite the arguments into invalid JSON. For more information, see [Prompt guards]({{< link-hextra path="/llm/prompt-guards/" >}}).

#### Model catalog enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2927 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2830 -->

A catalog entry now carries a freeform `tags` list alongside its pricing rates and tiers, which is why `agctl costs` became `agctl catalog`. Use tags to record capability or routing information about a model and to select models in policies. The initial catalog refresh at startup is also fixed. For the command, see [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}).

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

- **Bedrock**: Amazon Nova multimodal embeddings and Cohere v4 embeddings are supported. This release also corrects `top_k` translation, handles image URLs consistently across input types, and mutates a guardrail payload in place so that the original structure is preserved.
- **GitHub Copilot and DeepSeek**: Grok models are routed through the Responses API, and the DeepSeek preset advertises the Responses format.
- **Prompt caching across formats**: OpenAI cache markers are translated into their Anthropic and Bedrock equivalents.
- **Vertex AI embeddings**: `gemini-embedding-2` and later models are routed to the `:embedContent` endpoint, because Google no longer serves `:predict` for them. The `gemini-embedding-001` and `text-embedding-*` models stay on `:predict`. Because `:embedContent` embeds one input per call, a multi-input array now returns an explicit error instead of collapsing into a single vector.
- **Token counting**: The count-tokens endpoint is routed by default, and an Anthropic thinking budget is capped by the request's maximum token count.
- **Guardrail refactor**: Guardrails are restructured internally, and prompt guard logs record which pattern matched.
- **Error handling**: Proxy errors are classified by the phase they occurred in, and the original upstream HTTP status code is preserved on an error response.

For the list of supported providers, see the [LLM providers]({{< link-hextra path="/llm/providers/" >}}) docs.

### Traffic management {#v15-features-traffic}

#### Session affinity

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2779 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2825 -->

A new `sessionAffinity` backend policy pins requests that share an affinity value to the same endpoint, without any state shared between agentgateway replicas. A CEL expression extracts the value, which is hashed and mapped to an endpoint by weighted rendezvous hashing, so every replica independently picks the same backend.

```yaml
routes:
- backends:
  - service:
      name: default/my-service
      port: 8080
    policies:
      sessionAffinity:
        source: request.headers["x-session-id"]
```

Affinity is a fallback, not an override: it applies only when no explicit inference or MCP destination exists. Locality and health checks still take precedence. If the expression fails, returns a non-string value, or returns an empty value, the request falls back to normal load balancing instead of failing. Because the mapping is computed rather than remembered, a change to the set of endpoints can remap a value. AI provider backends are supported. For the field, see the [Configuration reference]({{< link-hextra path="/reference/configuration/" >}}).

#### Forward proxy authentication

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3098 -->

When agentgateway acts as a forward proxy, a client can now authenticate with the `Proxy-Authorization` header instead of `Authorization`. Agentgateway reads the credential from that header, strips it before the request goes upstream, and marks it sensitive so that its value is not logged. A failed `CONNECT` authentication returns a `407` response with a `Proxy-Authenticate` header, as the HTTP specification requires.

For the fields available today, see the [Configuration reference]({{< link-hextra path="/reference/configuration/" >}}).

#### Egress proxying, TCP backends, and CONNECT tunneling

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3013 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3095 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3014 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3124 -->

This release fills in the pieces that agentgateway needs to serve as an egress proxy for agent workloads.

- **Dynamic backends for TCP**: A TCP route can use a dynamic backend, so the destination comes from the connection rather than from static configuration.
- **CEL target selection**: A dynamic backend takes an optional `target` CEL expression that computes the `host:port` to dial. Use it to read a destination that external processing returned in `extproc.*` metadata, instead of having external processing rewrite the request authority. On a TCP route, the expression reads `source.*` and `destination.*`, where `destination.hostname` is the sniffed SNI. Omit `target` to keep dialing the destination that the request names.
- **Tunnel mode**: The `backendTunnel` policy takes a `mode` field. The default `auto` mode uses `CONNECT` for TLS and non-HTTP transports, and absolute-form requests for plaintext HTTP. The `connect` mode uses `CONNECT` for everything. You can also attach policies to the connection with the tunnel proxy itself.
- **Tunneling through a dynamic backend**: `CONNECT` requests can be tunneled through a dynamic proxy backend.
- **Backend connection timeouts**: A backend can set `connectTimeout`, along with the related handshake, request, keepalive, and maximum connection duration settings.

For a worked example, see the [`traffic-egress-proxy` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-egress-proxy) in the agentgateway repository, and for the timeout fields, see [Timeouts]({{< link-hextra path="/configuration/resiliency/timeouts/" >}}).

#### Rate limiting enhancements

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2661 -->

The `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset` headers are now returned on every rate-limited response, for both local and remote rate limiting, rather than only on some paths. Clients that back off based on those headers behave correctly when an LLM token limit is what rejected the request. For the headers, see [Rate limits]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}).

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

#### Read-only configuration storage

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2988 -->

A new `readOnly` value for `config.storage.mode` locks the admin UI and the admin API to reads. Every handler that mutates state, including configuration file writes, resource create and delete, and a model catalog refresh, returns a `403` response. Read-only endpoints such as the CEL playground, the logs API, and every `GET` are unaffected, and the UI shows a banner and blocks the same write paths before it calls the API. You can also set the `UI_READ_ONLY` environment variable to `true`.

```yaml
config:
  storage:
    mode: readOnly
```

If you deploy the standalone Helm chart, its `mode: readonly` value already serves configuration from a read-only ConfigMap. For the chart modes, see [Store config in a database]({{< link-hextra path="/deployment/helm/storage/" >}}).

#### Import a LiteLLM configuration

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2915 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2797 -->

The `agctl` importer converts a LiteLLM proxy configuration into an agentgateway standalone configuration and reports what it could and could not translate. This release adds wildcard model names, including `*`, prefix wildcards, and suffix wildcards. It also imports LiteLLM centralized credentials from `credential_list` and `litellm_credential_name`, which become reusable providers and provider references. The importer reports an explicit finding for a wildcard or credential that agentgateway cannot represent safely, rather than translating it incorrectly.

For more information, see [Import a configuration]({{< link-hextra path="/configuration/import/" >}}).

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
- **LLM token timing in access logs**: Access logs record time-to-first-token and related timing for LLM requests.
- **Explicit LLM payload logging**: Logging an LLM prompt or completion is now an explicit setting rather than a side effect of a CEL expression. When you log to a database, `frontendPolicies.logging.database.llm` chooses `metadata`, which stores usage, timing, and cost without content, or `full`, which also stores prompt and completion content.
- **Generated metrics reference**: The metrics documentation is generated from the schema, so it stays in step with the code.
- **CPU and heap profiles**: A new `agctl proxy profile` command collects pprof CPU and heap profiles from the admin endpoint.

For more information, see [Observability]({{< link-hextra path="/reference/observability/" >}}) and the [`agctl proxy profile`]({{< link-hextra path="/reference/agctl/agctl-proxy-profile/" >}}) reference.

#### Admin UI enhancements

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

For more information, see [Admin UI]({{< link-hextra path="/operations/ui/" >}}).

#### Operations and packaging

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3132 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2823 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2844 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2737 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2909 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3099 -->

- **Backend credential rotation**: A `backendAuth.key` that points at a file is reloaded when the file changes, so rotating a token no longer requires a restart or an unrelated configuration edit. The `backendTLS` and `jwtSign` key fields already behaved this way.
- **XDG config directory**: Agentgateway respects `XDG_CONFIG_HOME` when it looks for local configuration.
- **Pod labels in the standalone Helm chart**: The chart can label the agentgateway pod, which platforms such as Azure workload identity require. For the chart values, see [Install with Helm]({{< link-hextra path="/deployment/helm/install/" >}}).
- **Pluggable cryptography**: A `crypto` module centralizes random number generation, authenticated encryption with associated data (AEAD), digest, JWT, and TLS provider selection behind `crypto-*` build flags. A SymCrypt provider is available for builds that need it. AWS-LC remains the default.
- **Request tracing**: The `agctl` trace view no longer exits when output is truncated.

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

- Listener port swaps are reconciled dynamically, and a bind that transitions to an internal bind is stopped.
- Invalid header modifications are rejected, and route policy application is more consistent.

**Operations**

- A negative duration is clamped to zero instead of being rejected, and upstream connect duration is recorded at full precision.
- The admin UI analytics summary no longer loops its request.

For the complete list of fixes, see the [GitHub release notes](https://github.com/agentgateway/agentgateway/releases).
