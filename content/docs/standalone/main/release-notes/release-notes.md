---
title: Release notes
weight: 20
description: What's new, changed, and fixed in each agentgateway standalone release.
test: skip
---

Review the release notes for agentgateway standalone.

> [!NOTE]
> For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).

## ✨ Highlights {#v17-highlights}

Version 1.7 knows more about your models and your traffic than ever. Review the following highlights. Before you upgrade, also review the [breaking changes](#v17-breaking-changes). In particular, standalone deployments now encrypt MCP sessions by default, prompt guards inspect tool outputs by default, and dynamic backends can no longer reach loopback or link-local addresses.

- **[Model metadata and service-tier costs](#v17-catalog)**: The model catalog knows each model's context window, modalities, and capabilities, and shares them through `/v1/models` and CEL. Costs reflect the service tier that served each request.
- **[New LLM APIs and providers](#v17-llm)**: Agentgateway speaks the OpenAI Decisions and TypeSafe SystemOne APIs natively, adds Perplexity, and lets virtual models choose a target by calling your own routing service.
- **[Broader guardrails](#v17-guardrails)**: Vendor guardrails support `scope`, tool output is inspected by default, and MCP traffic can be filtered with CEL.
- **[Agent sessions and analytics](#v17-observability)**: Agentgateway detects agent sessions automatically, and the new `agctl standalone` CLI summarizes tokens, cost, cache hit rate, and latency by model, user, or any logged attribute.
- **[OIDC for browsers and API clients](#v17-security)**: One OIDC policy can accept both browser sessions and bearer ID tokens.

## 🔥 Breaking changes {#v17-breaking-changes}

### Standalone encrypts MCP sessions with a key by default {#v17-session-key}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/4031 -->

Agentgateway allows defining an MCP session key that encrypts MCP session IDs. The agentgateway Kubernetes control plane already generated this key. Standalone deployments now match this.

When you set neither `SESSION_KEY` nor `config.session.key`, agentgateway generates a key. In `file` storage mode, the default, agentgateway writes the key to `config.session.key` in your configuration file. In `hybrid` mode, agentgateway stores the key in the database. In `readOnly` mode, or when agentgateway cannot write the configuration file, such as in the default `readonly` mode of the Helm chart, session IDs stay unencrypted and agentgateway logs a warning.

If agentgateway generates a key during the upgrade, MCP sessions established before the upgrade are rejected, and clients must establish new sessions.

**Actions to take**:

* If you keep your configuration file in version control, set `SESSION_KEY` before you upgrade, so that agentgateway does not write a secret into the file.
* If you install with the Helm chart in the default `readonly` mode, set `session.secretName` to encrypt session IDs. For more information, see [Use an existing session key Secret]({{< link-hextra path="/documentation/setup/install/helm/#helm-session-secret" >}}).
* To keep sessions unencrypted, set `SESSION_KEY` or `config.session.key` to `disabled`.

For more information, see [Session key]({{< link-hextra path="/integrations/mcp/servers/http/#session-key" >}}).

### Prompt guards inspect tool outputs by default {#v17-prompt-guard-scope}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3975 -->

All request prompt guards except webhooks now honor `scope`, including `openAIModeration`, `googleModelArmor`, and `azureContentSafety`. The default request scope now also includes `toolOutput`, so every request guard that uses the default scope also inspects tool results. Response guards still inspect `messages` by default.

This change can produce new rejections or masking. It also increases the content that agentgateway sends to vendor guardrail APIs.

**Actions to take**: To keep the 1.6 behavior, set the scope of each request guard explicitly.

```yaml
scope:
- systemPrompt
- messages
```

Webhook guards do not support `scope`. They always inspect the system prompt and messages. For more information, see [Scope]({{< link-hextra path="/documentation/llm/prompt-guards/overview/#scope" >}}).

### CEL header lookups return every value of a repeated header {#v17-cel-headers}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3778 -->

A CEL lookup such as `request.headers["x-example"]` now returns a list when the header appears more than once in the request. Previously, the result depended on whether agentgateway could optimize the expression internally. The same lookup could return a single value in one expression and a list in another. Expressions that read headers that appear only once are unaffected.

**Actions to take**: Review CEL expressions that read request headers that a client can repeat, such as in authorization rules and transformations. Make sure that the expressions handle a list value. A comparison such as `request.headers["x-role"] == "guest"` returns `false` for a repeated header, so a client can skip a deny rule by sending the header twice. To read the first value, use `request.headers.raw()["x-role"][0]`. For more information, see [Repeated request headers]({{< link-hextra path="/reference/cel/variables/#repeated-headers" >}}).

### Dynamic backends cannot connect to loopback or link-local addresses {#v17-dynamic-loopback}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3889 -->

Dynamic backends now reject destinations that resolve to loopback, link-local, or unspecified addresses, such as cloud metadata servers. Agentgateway checks the address after DNS resolution and returns `503` for a rejected request.

**Actions to take**: If a dynamic backend must reach a service that is local to the gateway, set `config.backend.allowDynamicLoopback: true`. For more information, see [Loopback and link-local destinations]({{< link-hextra path="/documentation/configuration/egress-proxy/#loopback-destinations" >}}).

### Removed {#v17-removed}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/4072 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4080 -->

- **Messages-to-Completions preference**: The `AGENTGATEWAY_MESSAGES_PREFER_COMPLETIONS` environment variable is removed, as planned in 1.6. When a provider supports both formats, agentgateway always converts Anthropic Messages requests to the OpenAI Responses format. For an OpenAI-compatible server that does not implement `/v1/responses`, configure a `custom` provider that declares only the `completions` format. For more information, see [Provider format conversion]({{< link-hextra path="/documentation/llm/api-types/messages/#provider-format-conversion" >}}).

### Other behavior changes {#v17-behavior-changes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3864 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3661 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4061 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3826 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3812 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4029 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4002 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3964 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3925 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4011 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3973 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3815 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4054 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3802 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3873 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3897 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3793 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3957 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3928 -->

- **Proxy environment variables**: Callouts, such as JWKS fetches, external authorization requests, and AWS and Azure credential fetches, now use the `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, and `NO_PROXY` environment variables when `config.callouts.tunnel` is omitted. In 1.6, only Google Cloud Platform (GCP) credential fetches used these variables. If the environment that runs agentgateway exports these variables for other tools, callouts go through that proxy after you upgrade. To keep callouts direct, set `NO_PROXY` to `*`. For more information, see [Callout proxy]({{< link-hextra path="/documentation/configuration/callout-proxy/" >}}).
- **Normalized service tier**: `llm.serviceTier` is now one of `standard`, `flex`, `priority`, or `reserved`, whatever the provider's own naming. A provider tier that agentgateway does not recognize leaves the value unset. Update CEL expressions and dashboards that compare against provider-specific values such as `default`. For more information, see [Service tiers]({{< link-hextra path="/documentation/llm/cost-controls/costs/#service-tiers" >}}).
- **Request log database migration**: At startup, agentgateway adds analytics columns to the request log database, SQLite or PostgreSQL, and backfills them from existing rows. The migration can take some time on large databases. For more information, see [Database]({{< link-hextra path="/documentation/observability/access-logs/database/" >}}).
- **UI accepts bearer ID tokens**: An OIDC policy in `ui.policies.oidc` now defaults to `credentials: sessionOrBearer`. The UI accepts a bearer ID token in the `Authorization` header in addition to a browser session. To accept only browser sessions, as in 1.6, set `credentials: session` on the policy. For more information, see [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}).
- **Bedrock `tool_choice`**: Client `tool_choice` settings now reach Bedrock Converse as `toolChoice`. Previously, they were dropped silently. Requests that force tool use on a model that does not support it, such as with extended thinking, now return an error from Bedrock.
- **Bedrock service tier**: The OpenAI `service_tier` values `priority`, `default`, and `flex` now reach Bedrock Converse as `serviceTier`. Previously, they were dropped silently, and Bedrock served the request at the standard tier. Requests for a tier that the model does not support now return a `400` error from Bedrock. For more information, see [Service tier]({{< link-hextra path="/integrations/llm/providers/bedrock/#service-tier" >}}).
- **Token rate limits for non-chat APIs**: Token-based LLM rate limits now count usage from Embeddings, Rerank, Decisions, and SystemOne requests.
- **LLM buffer size**: The 32 MiB default LLM request buffer now applies before request policies run instead of after.
- **Webhook guardrail responses**: A webhook `pass` response that contains any field other than `reason` is now an error. So is a `mask` response whose messages contain extra fields, which previously passed the content unmasked. The error follows the guard's `failureMode`. For more information, see [Pass content from a webhook]({{< link-hextra path="/documentation/llm/prompt-guards/webhooks/#pass" >}}).
- **Google Model Armor errors**: A non-success response from Model Armor is now a guard failure and follows the guard's `failureMode`.
- **Backend mirrors**: Request mirrors that are attached to a backend now run after backend policies, so requests that backend authorization rejects are no longer mirrored. Mirrors that are attached to a route still run before backend policies.
- **MCP OpenAPI paths**: A non-root path in the `host` URL or `path` field of an OpenAPI MCP target now overrides the server path prefix from the schema. Previously, the path was ignored. An omitted, empty, or root path keeps the schema server path. For more information, see [Override the schema server path]({{< link-hextra path="/integrations/mcp/servers/openapi/#override-schema-server-path" >}}).
- **MCP OpenAPI responses**: Non-JSON responses from an OpenAPI MCP target are returned as typed MCP content, such as text, audio, or a binary resource, instead of a `{code, message}` wrapper. The HTTP status code of a `4xx` response is no longer part of the tool result. For more information, see [Tool response content]({{< link-hextra path="/integrations/mcp/servers/openapi/#tool-response-content" >}}).
- **MCP capabilities**: Multiplexed MCP sessions now advertise `listChanged` and `subscribe` only when at least one upstream target offers them. In 1.6, agentgateway always advertised them. Stateless sessions advertise none. For more information, see [Capabilities and change notifications]({{< link-hextra path="/integrations/mcp/servers/virtual/#capabilities" >}}).
- **MCP session errors**: Stateful MCP requests with a session ID that the proxy cannot decode, such as after the session key changes, now return `404` instead of `400`. Clients then start a new session.
- **gRPC health**: Errors that agentgateway itself returns to gRPC clients now record their `grpc-status`. Only server-side gRPC errors, such as `UNAVAILABLE` or `INTERNAL`, mark a backend unhealthy. A client-side gRPC status from an LLM provider no longer evicts the target from a failover group. This change matches how agentgateway treats `5xx` and `4xx` responses for HTTP.
- **gRPC policy calls**: When a gRPC policy call, such as to an external processing server, fails before it reaches the service, agentgateway now reports the mapped gRPC status instead of `UNKNOWN`. For example, DNS errors, refused connections, and timeouts report `UNAVAILABLE`.
- **Anthropic version header**: Agentgateway forwards the client's `anthropic-version` header instead of replacing it. When the client does not send the header, agentgateway still sets the default value `2023-06-01`.
- **Decisions and SystemOne requests to custom providers**: `/v1/decisions` and `/v1/systemone` requests now have their own `decisions` and `systemOne` route types. A `custom` provider that declares neither the `decisions` nor the `systemOne` format rejects them with `400`. This includes a provider without `formats`. In 1.6, agentgateway forwarded them without conversion. To keep serving these requests, declare the format that the upstream server supports. For more information, see [Custom providers without a Decisions format]({{< link-hextra path="/documentation/llm/api-types/decisions/#custom-provider-requirements" >}}).

## 🌟 New features {#v17-new-features}

### LLM APIs and providers {#v17-llm}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3832 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3839 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3852 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3928 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4018 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3771 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3769 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3823 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3867 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4030 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3828 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3776 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3691 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4010 -->

- **OpenAI Decisions and TypeSafe SystemOne**: Agentgateway supports the OpenAI Decisions API at `/v1/decisions` and the TypeSafe SystemOne API at `/v1/systemone` natively, and translates between them in both directions. To connect to TypeSafe, set `provider: typesafe` in an `llm.models` entry. For more information, see [Decisions]({{< link-hextra path="/documentation/llm/api-types/decisions/" >}}) and [TypeSafe]({{< link-hextra path="/integrations/llm/providers/typesafe/" >}}). A `custom` provider can declare the `decisions` or `systemOne` format. Azure supports both APIs for the `foundry` resource type.
- **Perplexity provider**: Set `provider: perplexity` in an `llm.models` entry to connect to Perplexity with built-in defaults. The provider accepts Responses and Messages requests, but not Chat Completions requests. For more information, see [Perplexity]({{< link-hextra path="/integrations/llm/providers/perplexity/" >}}).
- **Callout router for virtual models**: A virtual model can select its target model by calling an external HTTP service. Set `routing.callout` in an `llm.virtualModels` entry, with an optional fallback model and response cache. For more information, see [Callout routing]({{< link-hextra path="/documentation/llm/virtual-models/#callout-routing" >}}).
- **Per-model HTTP transformations**: Set `requestTransformation` on an `llm.models` entry, or in `llm.providers[].defaults` for every model of a provider, to modify the headers, body, and metadata of requests. A model's value replaces the provider default. For more information, see [LLM request transformation]({{< link-hextra path="/documentation/llm/transformations/#llm-request-transformation" >}}).
- **More accurate token counting**: A new tokenizer estimates token counts more accurately, runs about 10 times faster, and uses less memory.
- **Better format conversion**: Reasoning from vLLM and OpenRouter is preserved when agentgateway converts Chat Completions responses to Messages or Responses. Bedrock reasoning streams as reasoning items in Responses, and Bedrock redacted reasoning is preserved. Vertex AI Gemini models accept `http://` and `https://` URIs in file content. For more information, see [Encrypted reasoning]({{< link-hextra path="/integrations/llm/providers/bedrock/#encrypted-reasoning" >}}) and [Send file content by URI]({{< link-hextra path="/integrations/llm/providers/vertex/#send-file-content-by-uri" >}}).
- **More CEL during request policies**: Request-phase CEL expressions on LLM traffic can read `llm.requestModel` before provider overrides and `llmRequest` for the parsed JSON request body. For more information, see [Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}).

### Model catalog and cost {#v17-catalog}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3960 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4016 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3965 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3981 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3661 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3825 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3977 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3970 -->

The model catalog now describes models as well as pricing them. Catalog entries can include a display name, release date, lifecycle status, token limits, modalities, capabilities, and reasoning controls.

- **Model metadata in `/v1/models`**: `/v1/models` returns the catalog metadata, so that clients can discover what each model supports. Clients can limit the list with the `limit` query parameter, or fetch one model at `/v1/models/<model-id>`. The following excerpt shows an entry.

  ```json
  {
    "id": "gpt-5.5",
    "object": "model",
    "owned_by": "openai",
    "name": "GPT-5.5",
    "context_window": 1050000,
    "max_input_tokens": 922000,
    "max_tokens": 128000,
    "architecture": {"input_modalities": ["text", "image", "file"], "output_modalities": ["text"]},
    "capabilities": {"reasoning": true, "structured_outputs": true, "tools": true, "temperature": false},
    "supported_parameters": ["max_tokens", "reasoning", "reasoning_effort", "response_format", "structured_outputs", "tool_choice", "tools"]
  }
  ```

  For more information, see [Models]({{< link-hextra path="/documentation/llm/api-types/models/" >}}).
- **Model metadata in CEL**: The catalog entry of the model that served a request is available in CEL as `llm.model`, such as `llm.model.limits.context`. Agentgateway sets `llm.model` when it calculates the cost of the response. The value is unset when the model has no catalog entry. For more information, see [Use cost data]({{< link-hextra path="/documentation/llm/cost-controls/costs/#use-cost-data" >}}).
- **Service-tier pricing**: Pricing now accounts for the service tier that served each request. Agentgateway records the tier as `llm.serviceTier` for OpenAI, Azure, Anthropic, Bedrock, Vertex AI, and Gemini. A catalog pricing tier can set `serviceTier` alongside `contextOver`, so that flex or priority requests are priced at their actual rates. The built-in catalog includes service-tier prices for models such as those from OpenAI, Azure, and Vertex AI, and `agctl catalog import` adds Vertex AI Gemini tier rates from its default `vertex-pricing` source. You can configure rates for other models.

  ```yaml
  tiers:
  - serviceTier: priority
    rates: {input: "2.5", output: "15"}
  - serviceTier: priority
    contextOver: 272000
    rates: {input: "5", output: "22.5"}
  ```

  For more information, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/#advanced-catalog-format" >}}).
- **1-hour cache pricing**: Anthropic cache writes with a 1-hour TTL are priced with the new `cacheWrite1h` rate. When the rate is unset, the `cacheWrite` rate applies.
- **Budgets without a window**: An API key budget without a `window` accumulates usage for its lifetime, which provides a fixed spending limit. For more information, see [Per-key budgets]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/per-key/" >}}).

### Guardrails {#v17-guardrails}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3975 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3732 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3711 -->

- **Scope for vendor guardrails**: The `openAIModeration`, `googleModelArmor`, and `azureContentSafety` guards support `scope`, like the `regex` and `bedrockGuardrails` guards. For the change to the default scope, see [Prompt guards inspect tool outputs by default](#v17-prompt-guard-scope).
- **Reasoning and response scope**: Guards scan plaintext reasoning and thinking content as part of the `messages` scope. Response prompt guards support `scope`. For more information, see [Scope]({{< link-hextra path="/documentation/llm/prompt-guards/overview/#scope" >}}).
- **CEL processor for MCP guardrails**: Use `kind: expression` in `mcpGuardrails.processors` to reject or transform MCP requests and responses with CEL. No external policy server is required.

  ```yaml
  mcpGuardrails:
    processors:
    - kind: expression
      methods: {"tools/call": request}
      condition: mcp.params.name == 'restricted_tool'
      reject: "This tool is unavailable"
  ```

  For more information, see [Set up CEL guardrails]({{< link-hextra path="/documentation/mcp/guardrails/cel/" >}}).

### Security and identity {#v17-security}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3826 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3903 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4066 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3821 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3936 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3864 -->

- **OIDC with bearer tokens**: Set `credentials: sessionOrBearer` on an OIDC policy to accept a bearer ID token as well as a browser session. One policy then covers both browser and API clients. With `credentials: permissive`, browsers still sign in, and other requests fall through to other authentication policies. Pair `permissive` with an `authorization` policy, because it does not reject unauthenticated requests by itself. For more information, see [Bearer tokens for API clients]({{< link-hextra path="/documentation/configuration/security/oidc/#bearer-id-tokens" >}}).
- **OIDC session lifetime**: Set `sessionTtl` on an OIDC policy to change the lifetime of the browser session cookie from the 7-day default. The session never outlives the expiry of the ID token. For more information, see [Session cookies]({{< link-hextra path="/documentation/configuration/security/oidc/#session-cookies" >}}).
- **Backend credentials from CEL**: A backend authentication key can be computed from a CEL expression, such as a value that an external authorization server returns. Set `backendAuth.key.expression`, or `expression` in a `backendAuth.credentials` entry. For more information, see [Compute the key from the request]({{< link-hextra path="/documentation/configuration/security/backend-authn/key/#key-expression" >}}).
- **MCP authentication with token passthrough**: MCP authentication now works with a JWT policy that sets `preserveToken: true`. For more information, see [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn/" >}}).
- **Callouts through a proxy**: Send the requests that agentgateway makes on its own behalf, such as JWKS fetches, OIDC discovery, external authorization, and cloud provider credential fetches, through an HTTP proxy. Set `config.callouts.tunnel`, or use the standard proxy environment variables. For more information, see [Callout proxy]({{< link-hextra path="/documentation/configuration/callout-proxy/" >}}).

### Observability {#v17-observability}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3850 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4061 -->

- **Agent sessions**: Agentgateway detects the agent session that a request belongs to from well-known agent headers, such as `x-claude-code-session-id`. CEL expressions can read the session ID as `request.agent.session`, and the request log database records it as `agentgateway.session`. To identify sessions yourself, set `config.standardAttributes.session` to a CEL expression. For more information, see [Agent sessions]({{< link-hextra path="/reference/cel/variables/#agent-sessions" >}}).
- **Richer analytics**: The request log database records cache read and write tokens, reasoning tokens, time to first token, and time per output token. `agctl standalone analytics` summarizes requests, errors, tokens, cost, time to first token, tokens per second, and cache hit rate. You can group the results by provider, model, status, user, or any logged attribute, and bucket them by time or into latency histograms.

  ```sh
  agctl standalone analytics --by provider,model --since 168h
  agctl standalone analytics --by agentgateway.user --provider openai
  agctl standalone analytics --by model,ttft
  ```

  For more information, see [Query analytics with agctl]({{< link-hextra path="/documentation/llm/cost-controls/dashboard/#cli" >}}).

### MCP {#v17-mcp}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3976 -->

- **Session cleanup across replicas**: Stateful Streamable HTTP `DELETE` requests now resume the session before agentgateway closes the upstream sessions. Any replica with the same session key can close the upstream sessions.

### Traffic management and operations {#v17-operations}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3842 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3797 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3833 -->

- **Standalone Helm session key Secret**: Set `session.secretName` to load the AES-256-GCM session key from an existing Kubernetes Secret. The chart passes the Secret's `key` entry to the proxy as the `SESSION_KEY` environment variable, which takes precedence over `config.session.key`. For more information, see [Use an existing session key Secret]({{< link-hextra path="/documentation/setup/install/helm/#helm-session-secret" >}}).
- **Native histogram scraping**: The PodMonitor of the standalone Helm chart supports native histogram scraping, relabelings, and metric relabelings. Native histogram scraping is off by default and requires Prometheus v3.8.0 or later and Prometheus Operator v0.88.0 or later. For more information, see [Scrape native histograms]({{< link-hextra path="/documentation/observability/metrics/prometheus/#native-histograms" >}}).
- **Graceful HTTP/1 drain**: When agentgateway drains or a connection reaches its maximum connection duration, HTTP/1 clients receive `Connection: close` on the next response, so that they close the connection cleanly. For more information, see [Shutdown and drain]({{< link-hextra path="/documentation/configuration/static-configuration/#shutdown-drain" >}}).

### CLI and UI {#v17-cli-ui}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/4032 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3994 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4008 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4004 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4013 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3803 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4020 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3923 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3919 -->

- **`agctl standalone`**: Manage a standalone agentgateway through its admin API. Use `get`, `apply`, and `delete` for resources such as models, policies, and MCP targets. Use `keys` and `budgets` to manage API keys and check their budgets. For more information, see [Manage resources with agctl]({{< link-hextra path="/documentation/operations/config-resources/#agctl" >}}).
- **Raw editing**: Every form editor in the UI has a raw YAML mode. Fields that the form does not support are kept when you save.
- **Clearer forms**: Required fields and schema help are shown consistently, and errors are reported next to the field.
- **Settings page**: A top-level **Settings** page groups gateway-wide settings for the UI and observability.
- **Client Setup for Continue**: Client Setup includes a recipe for Continue. For more information, see [Client Setup]({{< link-hextra path="/documentation/setup/ui/launch-ui/#client-setup" >}}).
- **More UI improvements**: You can rotate an API key with an auto-generated value, and search the values of the **Users** and **Groups** log filters.

## 🐛 Fixes {#v17-fixes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3996 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3940 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3744 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3773 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3721 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3759 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3764 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3853 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3920 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3676 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3899 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3888 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3893 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3774 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3786 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3894 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4062 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4057 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3892 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3863 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3746 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3933 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3896 -->

**Traffic management**

- Requests that agentgateway answers locally, such as for an unknown model or a failed model authorization, now include the request data in access logs and CEL.
- External authorization with `includeRequestBody` and no `maxRequestBytes` no longer rejects every request that has a body with `413`. The limit defaults to 8192 bytes.

**LLM**

- OpenAI-compatible responses, such as from Gemini, count reasoning tokens as output usage when agentgateway converts the response to Messages or Responses and when agentgateway records normalized usage.
- Messages requests that ask for reasoning no longer send reasoning parameters to older OpenAI chat models whose IDs start with `gpt-3.5`, `gpt-4`, or `chatgpt-4o`.
- Bedrock conversion keeps prompt-cache markers when unsupported Messages blocks or blank Chat Completions text are dropped, and Anthropic cache TTLs reach Bedrock cache points.
- Mid-stream system messages no longer invalidate the Bedrock prompt cache.
- LLM stream conversions now enforce buffer limits. Responses namespace tool descriptions larger than 8 MiB are rejected with `RequestTooLarge`, and tool-call arguments are buffered only when tool-call logging is on.
- Built-in OpenAI-compatible providers, such as Groq and DeepInfra, no longer duplicate the base path, such as `/v1/v1/...`, on Detect and Passthrough routes.
- Gemini tool schemas that use `oneOf` no longer return empty tool calls.
- Passthrough no longer fails on SSE streams with an unterminated final event.
- Claude models on Azure AI Foundry now follow the Anthropic prompt-cache token convention for normalized token counts and cost.
- A route-level API key budget no longer replaces a gateway-level budget.

**MCP**

- Backend authorization rules for MCP requests evaluate transformed tool names after route-level body transformations run.
- MCP authentication derives JWKS URLs without a double slash when an issuer value ends with `/`.
- MCP streamable HTTP `POST` requests can list `application/json` and `text/event-stream` in separate `Accept` header lines instead of one comma-separated value.
- MCP responses now honor the `responseIdleTimeout` response idle timeout, which previously did not apply on MCP routes. A response, including an SSE stream, that sends no data for longer than the timeout is now ended.
- MCP target conditions are now checked on each request of a session, not only when the session is initialized. A request whose conditions select different targets than the session returns `404`, and the client starts a new session. For more information, see [Target conditions]({{< link-hextra path="/integrations/mcp/servers/virtual/#target-conditions" >}}).
- Resumed MCP sessions no longer keep outdated settings after a configuration change.

**UI**

- The MCP and LLM playgrounds no longer send the credentials of the signed-in session implicitly.

**Operations**

- Standalone configuration reloads now track files that agentgateway reads during parsing, such as `backendTLS.root` certificate files, so later file changes are picked up without a process restart.
- Metrics requests use the OpenMetrics content type by default, while browser requests use `text/plain` so browsers display metrics instead of downloading them.
- The UI can save a configuration with numeric map keys, such as the ports of a `services` entry.
