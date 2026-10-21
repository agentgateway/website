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

Version 1.7 knows more about your models and your traffic. Review the following highlights. Before you upgrade, also review the [breaking changes](#v17-breaking-changes), because several defaults change.

- **[Model metadata and service-tier costs](#v17-catalog)**: The model catalog knows each model's context window, modalities, and capabilities, and shares them through `/v1/models` and CEL. Costs reflect the service tier that served each request.
- **[New LLM APIs and providers](#v17-llm)**: Agentgateway speaks the OpenAI Decisions and TypeSafe SystemOne APIs natively, adds Perplexity, and lets virtual models choose a target by calling your own routing service.
- **[Broader guardrails](#v17-guardrails)**: Vendor guardrails support `scope`, tool output is inspected by default, and MCP traffic can be filtered with CEL.
- **[Agent sessions and analytics](#v17-observability)**: Agentgateway detects agent sessions automatically, and the new `agctl standalone` CLI summarizes tokens, cost, cache hit rate, and latency by model, user, or any logged attribute.
- **[OIDC for browsers and API clients](#v17-security)**: One OIDC policy can accept both browser sessions and bearer ID tokens.

## 🔥 Breaking changes {#v17-breaking-changes}

### Standalone generates an MCP session key by default {#v17-session-key}

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

### CEL lookups of a repeated request header return every value {#v17-cel-headers}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3778 -->

A CEL lookup such as `request.headers["x-example"]` now returns a list when the header appears more than once in the request. Previously, the result depended on whether agentgateway could optimize the expression internally. The same lookup could return a single value in one expression and a list in another. Expressions that read headers that appear only once are unaffected.

**Actions to take**: Review CEL expressions that read request headers that a client can repeat, such as in authorization rules and transformations. Make sure that the expressions handle a list value. For more information, see [CEL variables]({{< link-hextra path="/reference/cel/variables/" >}}).

### Dynamic backends cannot connect to loopback or link-local addresses {#v17-dynamic-loopback}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3889 -->

Dynamic backends now reject destinations that resolve to loopback, link-local, or unspecified addresses, such as cloud metadata servers. Agentgateway checks the address after DNS resolution and returns `503` for a rejected request.

**Actions to take**: If a dynamic backend must reach a service that is local to the gateway, set `config.backend.allowDynamicLoopback: true`. For more information about dynamic backends, see [Egress proxy]({{< link-hextra path="/documentation/configuration/egress-proxy/" >}}).

## ⚠️ Removed {#v17-removed}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/4072 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4080 -->

The `AGENTGATEWAY_MESSAGES_PREFER_COMPLETIONS` environment variable is removed, as planned in 1.6. When a provider supports both formats, agentgateway always converts Anthropic Messages requests to the OpenAI Responses format. For an OpenAI-compatible server that does not implement `/v1/responses`, configure a `custom` provider that declares only the `completions` format. For more information, see [Provider format conversion]({{< link-hextra path="/documentation/llm/api-types/messages/#provider-format-conversion" >}}).

## 🔄 Other behavior changes {#v17-behavior-changes}

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
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3802 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3873 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3897 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3793 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3957 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3928 -->

- **Proxy environment variables**: Callouts, such as JWKS fetches, external authorization requests, and AWS and Azure credential fetches, now use the `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, and `NO_PROXY` environment variables when `config.callouts.tunnel` is omitted. In 1.6, only Google Cloud Platform (GCP) credential fetches used these variables. If the environment that runs agentgateway exports these variables for other tools, callouts go through that proxy after you upgrade. To keep callouts direct, set `NO_PROXY` to `*`. For more information, see [Callout proxy]({{< link-hextra path="/documentation/configuration/callout-proxy/" >}}).
- **Normalized service tier**: `llm.serviceTier` is now one of `standard`, `flex`, `priority`, or `reserved`, whatever the provider's own naming. A provider tier that agentgateway does not recognize leaves the value unset. Update CEL expressions and dashboards that compare against provider-specific values such as `default`.
- **Request log database migration**: At startup, agentgateway adds analytics columns to the request log database, SQLite or PostgreSQL, and backfills them from existing rows. The migration can take some time on large databases. For more information, see [Database]({{< link-hextra path="/documentation/observability/access-logs/database/" >}}).
- **UI accepts bearer ID tokens**: An OIDC policy in `ui.policies.oidc` now defaults to `credentials: sessionOrBearer`. The UI accepts a bearer ID token in the `Authorization` header in addition to a browser session. To accept only browser sessions, as in 1.6, set `credentials: session` on the policy. For more information, see [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}).
- **Bedrock `tool_choice`**: Client `tool_choice` settings now reach Bedrock Converse as `toolChoice`. Previously, they were dropped silently. Requests that force tool use on a model that does not support it, such as with extended thinking, now return an error from Bedrock.
- **Token rate limits for non-chat APIs**: Token-based LLM rate limits now count usage from Embeddings, Rerank, Decisions, and SystemOne requests.
- **LLM buffer size**: The 32 MiB default LLM request buffer now applies before request policies run instead of after.
- **Webhook guardrail responses**: A webhook `pass` response that contains any field other than `reason` is now an error instead of passing the content unmasked. The error follows the guard's `failureMode`.
- **Google Model Armor errors**: A non-success response from Model Armor is now a guard failure and follows the guard's `failureMode`.
- **Backend mirrors**: Request mirrors that are attached to a backend now run after backend policies, so requests that backend authorization rejects are no longer mirrored. Mirrors that are attached to a route still run before backend policies.
- **MCP OpenAPI paths**: A non-root path in the `host` URL or `path` field of an OpenAPI MCP target now overrides the server path prefix from the schema. Previously, the path was ignored. An omitted, empty, or root path keeps the schema server path. For more information, see [Override the schema server path]({{< link-hextra path="/integrations/mcp/servers/openapi/#override-schema-server-path" >}}).
- **MCP OpenAPI responses**: Non-JSON responses from an OpenAPI MCP target are returned as typed MCP content, such as text, audio, or a binary resource, instead of a `{code, message}` wrapper.
- **MCP session errors**: Stateful MCP requests with a session ID that the proxy cannot decode, such as after the session key changes, now return `404` instead of `400`. Clients then start a new session.
- **gRPC health**: Errors that agentgateway itself returns to gRPC clients now record their `grpc-status`. Only server-side gRPC errors, such as `UNAVAILABLE` or `INTERNAL`, mark a backend unhealthy. A client-side gRPC status from an LLM provider no longer evicts the target from a failover group. This change matches how agentgateway treats `5xx` and `4xx` responses for HTTP.
- **gRPC policy calls**: When a gRPC policy call, such as to an external processing server, fails before it reaches the service, agentgateway now reports the mapped gRPC status instead of `UNKNOWN`. For example, DNS errors, refused connections, and timeouts report `UNAVAILABLE`.
- **Anthropic version header**: Agentgateway forwards the client's `anthropic-version` header instead of replacing it. When the client does not send the header, agentgateway still sets the default value `2023-06-01`.
- **SystemOne requests to custom providers**: `/v1/systemone` requests now have their own `systemOne` route type. A `custom` provider without `formats` rejects them with `400`. In 1.6, agentgateway forwarded them without conversion. To keep serving these requests, declare the `systemOne` format. For more information, see [Custom providers]({{< link-hextra path="/integrations/llm/providers/custom/#configuring-a-custom-provider" >}}).

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

- **OpenAI Decisions and TypeSafe SystemOne**: Agentgateway supports the OpenAI Decisions API at `/v1/decisions` and the TypeSafe SystemOne API at `/v1/systemone` natively, and translates between them in both directions. To connect to TypeSafe, set `provider: typesafe` in an `llm.models` entry. For more information, see [TypeSafe]({{< link-hextra path="/integrations/llm/providers/typesafe/" >}}). A `custom` provider can declare the `decisions` or `systemOne` format. Azure supports both APIs for the `foundry` resource type.
- **Perplexity provider**: Set `provider: perplexity` in an `llm.models` entry to connect to Perplexity with built-in defaults. The provider accepts Responses and Messages requests, but not Chat Completions requests. For more information, see [Perplexity]({{< link-hextra path="/integrations/llm/providers/perplexity/" >}}).
- **Callout router for virtual models**: A virtual model can select its target model by calling an external HTTP service. Set `routing.callout` in an `llm.virtualModels` entry, with an optional fallback model and response cache. For more information, see [Callout routing]({{< link-hextra path="/documentation/llm/virtual-models/#callout-routing" >}}).
- **Per-model HTTP transformations**: Set `requestTransformation` on an `llm.models` entry, or in `llm.providers[].defaults` for every model of a provider, to modify the headers, body, and metadata of requests. A model's value replaces the provider default. For more information, see [LLM request transformation]({{< link-hextra path="/documentation/llm/transformations/#llm-request-transformation" >}}).
- **More accurate token counting**: A new tokenizer estimates token counts more accurately, runs about 10 times faster, and uses less memory.
- **Better format conversion**: Reasoning from vLLM and OpenRouter is preserved when agentgateway converts Chat Completions responses to Messages or Responses. Bedrock reasoning streams as reasoning items in Responses, and Bedrock redacted reasoning is preserved. Vertex AI Gemini models accept `http://` and `https://` URIs in file content. For more information, see [Send file content by URI]({{< link-hextra path="/integrations/llm/providers/vertex/#send-file-content-by-uri" >}}).
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
- **Service-tier pricing**: Agentgateway records the service tier that served each request as `llm.serviceTier` for OpenAI, Azure, Anthropic, Bedrock, Vertex AI, and Gemini. A catalog pricing tier can set `serviceTier` alongside `contextOver`, so that flex or priority requests are priced at their actual rates. The built-in catalog includes service-tier prices for models such as those from OpenAI, Azure, and Vertex AI, and `agctl catalog import` adds Vertex AI Gemini tier rates from its default `vertex-pricing` source. You can configure rates for other models.

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
- **Callout proxy**: Send the requests that agentgateway makes on its own behalf, such as JWKS fetches, OIDC discovery, external authorization, and cloud provider credential fetches, through an HTTP proxy. Set `config.callouts.tunnel`, or use the standard proxy environment variables. For more information, see [Callout proxy]({{< link-hextra path="/documentation/configuration/callout-proxy/" >}}).

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
- MCP target conditions are now checked on each request of a session, not only when the session is initialized.
- Resumed MCP sessions no longer keep outdated settings after a configuration change.

**UI**

- The MCP and LLM playgrounds no longer send the credentials of the signed-in session implicitly.

**Operations**

- Standalone configuration reloads now track files that agentgateway reads during parsing, such as `backendTLS.root` certificate files, so later file changes are picked up without a process restart.
- Metrics requests use the OpenMetrics content type by default, while browser requests use `text/plain` so browsers display metrics instead of downloading them.
- The UI can save a configuration with numeric map keys, such as the ports of a `services` entry.

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

The `params.baseUrl` field of an `llm.models` entry now always sets the full base path. A URL with no path, such as `https://api.openai.com`, sets the base path to `/`. In 1.5, `custom` and `ollama` providers appended `/v1`. Built-in providers such as `openAI` forwarded the client's path.

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

The `AGENTGATEWAY_LEGACY_LLM_USAGE_TOKEN_SEMANTICS` environment variable is removed. In 1.5, it restored the earlier token counts that left out cache tokens. In logs, metrics, and CEL, input and total token counts now always include cache tokens. The token usage that agentgateway returns to clients follows the API that the client calls instead. For more information, see [Other behavior changes](#v16-behavior-changes).

## 🔄 Other behavior changes {#v16-behavior-changes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3639 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3177 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3599 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3112 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3533 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3462 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3426 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3618 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3687 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3669 -->

- **YAML configuration**: Unquoted values such as `no` stay strings instead of being interpreted as booleans. Use `true` or `false` for boolean settings. YAML configuration errors now include line numbers, and the UI preserves comments and formatting where possible when it writes the configuration file.
- **Backend authentication errors**: When agentgateway cannot get credentials from a provider, such as an OAuth token endpoint, AWS STS, or Azure, the request now fails with `502` instead of `500`. Local failures, such as a static key that cannot be set, return `500` instead of `503`.
- **Backend request timeout**: The `backendRequestTimeout` field of the `timeout` policy now also limits the time to read a buffered body. This limit applies to external authorization and CEL expressions that use `response.body`, for example. Streamed bodies are unaffected.
- **Access log level**: Request log records now use `error` when agentgateway records a request error, and `info` otherwise. In 1.5, all request records used `info`.
- **Guardrail results**: The `guardrails` CEL variable now has an entry for every guard that ran, including a new `allow` action. To find interventions only, filter on `action != "allow"`.
- **Failover eviction**: A virtual model with more than one priority group now evicts a failing target by default. A `health` policy replaces this default. To keep failover, include `health.eviction` in each `llm.models` entry where you configure a health policy. For more information, see [Health vs. eviction]({{< link-hextra path="/documentation/llm/virtual-models/#health-vs-eviction" >}}).
- **Model catalog refresh**: The **Refresh base costs** button in the UI now downloads the agentgateway model catalog, which tracks the `main` branch of the agentgateway repository, instead of the models.dev catalog. The catalog on `main` can gain fields after this release. So that a refresh keeps working, agentgateway ignores catalog fields that it does not recognize, and drops any pricing tier with a condition that it cannot apply. For more information, see [Import costs (UI)]({{< link-hextra path="/documentation/llm/cost-controls/costs/#import-costs-ui" >}}).
- **Token usage in responses**: The `usage` that agentgateway returns to clients now follows the conventions of the API that the client calls, whichever provider serves the request. Anthropic Messages responses leave cache tokens out of `input_tokens` and report them in `cache_read_input_tokens` and `cache_creation_input_tokens`. OpenAI Chat Completions and Responses include cache tokens in the input and total token counts. For example, a Chat Completions request to an Anthropic or Amazon Bedrock model that writes to the prompt cache now reports those cache tokens in `prompt_tokens`. If a client calculates usage or cost from these fields, review its counts after you upgrade.
- **Policy service timeouts**: Calls to external services default to a timeout of 2 seconds for gRPC external authorization and 10 seconds for rate limit and external processing services.
- **Streaming guardrails**: Agentgateway now rejects content if a provider guard fails while checking a streamed response or realtime connection. To keep the 1.5 behavior, set `failureMode: failOpen` on the guard. For example, set it in `ai.promptGuard.response[].bedrockGuardrails`. For more information, see [Provider failures]({{< link-hextra path="/documentation/llm/prompt-guards/overview/#provider-failures" >}}).

## 🌟 New features {#v16-new-features}

### LLM {#v16-llm}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3741 -->
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

- **Meta provider**: Use `provider: meta` to connect to the Meta Model API with built-in defaults for Chat Completions, Messages, and Responses. For more information, see [Meta]({{< link-hextra path="/integrations/llm/providers/meta/" >}}).
- **Wildcard models in `/v1/models`**: For wildcard names in `llm.models`, `/v1/models` lists matching model IDs from the catalog. For example, `*` for the OpenAI provider expands to IDs such as `gpt-4o`. To list the pattern as in 1.5, set `llm.discovery: disabled`. For more information, see [Wildcard expansion]({{< link-hextra path="/documentation/llm/api-types/models/#wildcard-expansion" >}}).
- **Response idle timeout**: A response idle timeout ends a response if the backend stops sending body data for the configured time. It does not limit the duration of an active stream. Set `responseIdleTimeout` in the `timeout` policy. You can now also set the `timeout` policy in `llm.policies`. For more information, see [Route timeouts]({{< link-hextra path="/documentation/configuration/resiliency/timeouts/#route-timeouts" >}}).
- **Larger LLM buffer**: LLM requests can now buffer up to 32 MiB by default, up from 2 MiB. The larger buffer supports long-context prompts. To change the limit, set `frontendPolicies.http.maxBufferSize`. For more information, see [Body buffering]({{< link-hextra path="/documentation/configuration/traffic-management/buffer/" >}}).
- **Per-page pricing**: To price OCR and document models that bill per processed page, set `rates.perPage` in the model's cost catalog entry. For more information, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/#advanced-catalog-format" >}}).
- **Bedrock Mantle routing**: The Bedrock provider chooses the Runtime or Mantle endpoint for each model. To set the preference, use `params.bedrockEndpointPreference` on an `llm.models` entry, or set it in the UI. For more information, see [Bedrock Mantle]({{< link-hextra path="/integrations/llm/providers/bedrock/#bedrock-mantle" >}}).
- **More accurate Messages conversion**: Conversion between the Messages and OpenAI formats now carries citations, refusals, the `strict` setting of tool schemas, reasoning effort, and images in tool results. A context overflow error from the provider is translated so that Claude Code can compact and retry. For more information, see [Converted replies and errors]({{< link-hextra path="/documentation/llm/api-types/messages/#converted-replies-and-errors" >}}).
- **Guardrails**: Provider guards in `ai.promptGuard` or `llm.policies.guardrails` now support `failureMode`. Webhook guards support `target.policies` to configure the webhook connection. The built-in credit card pattern now checks the Luhn checksum. For more information, see [Provider failures]({{< link-hextra path="/documentation/llm/prompt-guards/overview/#provider-failures" >}}) and the [JEV integration]({{< link-hextra path="/integrations/llm/guardrails/jev/" >}}).

### Security {#v16-security}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3291 -->
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
- **OIDC session refresh**: Agentgateway automatically uses a refresh token from the identity provider to renew an expired browser session. The refreshed ID token must identify the same user; a missing ID token or a different `sub` requires sign-in again. Add `offline_access` when your provider requires that scope to issue refresh tokens. For more information, see [Session cookies]({{< link-hextra path="/documentation/configuration/security/oidc/#session-cookies" >}}).
- **Hashed API keys in the UI**: The UI stores new API keys as hashes by default.
- **JWT validation**: With several JWT providers, agentgateway tries each provider whose `issuer` and JWKS key ID match the token. Agentgateway also checks the `nbf` (not before) claim to reject tokens that are not yet valid. This check allows 60 seconds of leeway for clock skew. The `audiences` field of the `mcpAuthentication` route policy is now optional. For more information, see [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn/#jwt-claim-validation" >}}).
- **Backend authentication**: In the `backendAuth` policy or the `auth` field of an `llm.models` entry, AWS `assumeRole` takes an `externalId`, and Azure authentication takes `scopes`. For more information, see [AWS]({{< link-hextra path="/documentation/configuration/security/backend-authn/providers/aws/#assume-a-role" >}}) and [Azure]({{< link-hextra path="/documentation/configuration/security/backend-authn/providers/azure/#configure-token-scopes" >}}).
- **Network authorization by destination**: Rules in `frontendPolicies.networkAuthorization` can match on `destination.address`, `destination.port`, and the TLS SNI hostname in `destination.hostname`. For more information, see [Require TLS SNI]({{< link-hextra path="/documentation/configuration/security/network-authz/#require-tls-sni" >}}).

### MCP {#v16-mcp}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3615 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3544 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3601 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3197 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3425 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3393 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3593 -->

- **Conditional virtual MCP targets**: Set `mcp.targets[].condition` to a CEL expression to select which targets participate in a request before agentgateway initializes or contacts them. Conditions require at least two configured targets. For more information, see [Target conditions]({{< link-hextra path="/integrations/mcp/servers/virtual/#target-conditions" >}}).
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
- **External processing**: Set `extProc.failureMode: failOpen` in a route's `policies` section to forward requests when the processing server fails. Agentgateway now also forwards the request body if the processing server fails before agentgateway sends any body bytes to it. For more information, see [Failure modes]({{< link-hextra path="/documentation/configuration/traffic-management/extproc/#failure-modes" >}}).
- **Graceful drain**: During shutdown, agentgateway stops accepting new connections after `config.connectionMinTerminationDeadline`. It continues to serve open connections until `config.connectionTerminationDeadline`. For more information, see [Shutdown and drain]({{< link-hextra path="/documentation/configuration/static-configuration/#shutdown-drain" >}}).
- **Helm chart scaling**: The standalone chart can create a PodDisruptionBudget and a HorizontalPodAutoscaler. For more information, see [Create a PodDisruptionBudget]({{< link-hextra path="/documentation/setup/install/helm/#helm-pdb" >}}).
- **Telemetry**: OTLP access logs use the `agentgateway.access` instrumentation scope. The request duration metric records failed requests with an `error_type` label. For the metrics, see the [metrics reference]({{< link-hextra path="/documentation/observability/metrics/reference/#llm" >}}).

### OpenTelemetry field names {#v16-otel-attributes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->

You can now opt in to OpenTelemetry field names for stdout access logs. Set `frontendPolicies.accessLog.preset: otel`. For more information, see [Use OpenTelemetry field names]({{< link-hextra path="/documentation/observability/access-logs/view/#preset" >}}).

## 🐛 Fixes {#v16-fixes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3703 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3214 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3690 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3726 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3722 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3720 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3724 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3743 -->

**Traffic management**

- Connections with `maxConnectionDuration` close with up to 10% jitter, which reduces synchronized reconnects at the configured connection age.
- Bare backend references in standalone HTTP routes, TCP routes, and MCP target backend hosts now resolve to top-level backends. A reference such as `backend: upstream` no longer fails at request time with `service not found` when the top-level backend is named `upstream`.
- Route path regexes now use full-path matching consistently, including patterns with alternation or lazy quantifiers.

**LLM**

- Vertex AI catalog lookups resolve Anthropic model aliases such as `claude-sonnet-4-5-20250929`, `anthropic/claude-sonnet-4-5@20250929`, and `publishers/anthropic/models/claude-sonnet-4-5@20250929`.
- A client query string, such as the `?beta=true` that Claude Code sends, is no longer forwarded when an LLM request is converted to another provider format. Before, strict providers such as Gemini rejected these requests with a `400` error.

**MCP**

- Access-log CEL expressions can now read dynamic metadata that ExtMCP request-phase guardrails return through `mcpGuardrails`, including on resumed stateful MCP sessions. For more information, see [Log MCP guardrail metadata]({{< link-hextra path="/documentation/observability/access-logs/view/#mcp-guardrails" >}}).
- OpenAPI MCP tools return `image/*` responses as MCP image content instead of UTF-8-decoded text.

**Operations**

- Standalone Helm installs can set `podDisruptionBudget.maxUnavailable` without also rendering the default `podDisruptionBudget.minAvailable` value.
