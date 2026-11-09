---
title: Release notes
weight: 20
description: What's new, changed, and fixed in each agentgateway on Kubernetes release.
---

Review the release notes for agentgateway on Kubernetes.

> [!NOTE]
> For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).

## 🔥 Breaking changes {#v18-breaking-changes}

### Invalid backend TLS policies fail closed {#v18-backend-tls-fail-closed}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/4198 -->

Requests to a backend with an invalid backend TLS policy, such as a policy with a bad CA certificate or hostname, now fail with HTTP `503`. The proxy reports the error as a warning. Previously, a backend whose policy was never accepted sent requests in plaintext, and a backend whose policy got an invalid update kept the last accepted version. An invalid update to a working policy now also fails closed. For more information, see [BackendTLS]({{< link-hextra path="/documentation/security/backendtls/" >}}).

### Model transformations rewrite the model in provider URL paths {#v18-path-model-transformations}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/4188 -->

Model transformations now rewrite the model ID in the request path of Bedrock, Vertex AI, and Gemini requests. Previously, model transformations applied only to the `model` field in the request body. For more information, see [Transform requests]({{< link-hextra path="/documentation/llm/transformations/" >}}).

## 🌟 New features {#v18-new-features}

### LLM {#v18-llm}

- **AgentgatewayModel API is always enabled**: The `AgentgatewayModel` API no longer uses the `agentgatewayModels.enabled` Helm value or the `AGW_ENABLE_AGENTGATEWAY_MODELS` environment variable. Remove those settings from custom Helm values; listeners still opt in to model serving by listing `AgentgatewayModel` in `allowedRoutes.kinds`. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4280 -->
- **Custom model sources can join model routing**: Controller extensions can register additional Kubernetes model APIs as model sources. When an installation includes one, model listeners, model-serving HTTPRoute rules, virtual model targets, and status treat its kind as a model kind alongside `AgentgatewayModel`. For more information, see [About models]({{< link-hextra path="/documentation/llm/models/about/" >}}). <!-- ref: https://github.com/agentgateway/agentgateway/pull/4292 -->
- **Model discovery advertises preferred endpoints**: The `/v1/models` response now includes `preferred_endpoints` for models whose served client paths are known. Catalog entries can use `endpoints` to mark non-chat models, such as embedding or image models, so clients can pick compatible API paths. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4272 -->
- **Nebius Token Factory provider**: Set `spec.provider: Nebius` in an AgentgatewayModel to route requests to Nebius Token Factory at `https://api.tokenfactory.nebius.com/v1`. The preset supports Chat Completions and Embeddings, and the built-in model catalog includes Nebius pricing. For more information, see [Nebius Token Factory]({{< link-hextra path="/integrations/llm/providers/nebius/" >}}). <!-- ref: https://github.com/agentgateway/agentgateway/pull/4225 -->
- **Original client model**: CEL expressions can read `llm.originalModel`, the model name that the client sent before virtual model routing, aliases, provider overrides, or request body rewrites. Cost lookup now also falls back to `llm.originalModel` when the catalog has no price for the response or request model, so requests whose model was rewritten are still priced. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4215 -->
- **Ultrafast service-tier pricing**: OpenAI and Amazon Bedrock responses that report the `ultrafast` service tier are now priced with matching model catalog tiers and exposed to CEL as `llm.serviceTier`. Add `serviceTier: "ultrafast"` to catalog tiers to set separate rates for this tier. For more information, see [Service tiers]({{< link-hextra path="/documentation/llm/cost-controls/costs/#service-tiers" >}}). <!-- ref: https://github.com/agentgateway/agentgateway/pull/4259 -->
- **Virtual model targets can point to other virtual models**: Weighted, conditional, and callout virtual model targets can now route through another virtual model before they resolve to a concrete model. In standalone mode, `/v1/models` now includes target-derived metadata for failover virtual models. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4216 -->

### Observability {#v18-observability}

- **Active upstream request and connection metrics**: The data plane now emits `agentgateway_requests_active` and `agentgateway_upstream_connections_active` gauges with a `backend` label. Use them to monitor active backend requests and open upstream connections. For more information, see [Data plane metrics]({{< link-hextra path="/documentation/observability/metrics/dataplane/" >}}). <!-- ref: https://github.com/agentgateway/agentgateway/pull/4187 -->
- **OTLP access log records include a body and timestamp**: OTLP access log records now include a timestamp and a body that joins the request method, path, and response status, such as `POST /v1/messages 200`. Previously, exported records had an empty body and no timestamp. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4312 -->
- **Outbound calls in access logs**: Access log CEL expressions can use `upstreamCalls` to record outbound primary and policy HTTP calls, including MCP target calls after backend authentication or token exchange. For more information, see [Log outbound calls from access logs]({{< link-hextra path="/reference/cel/yaml-and-examples/#log-outbound-calls-from-access-logs" >}}). <!-- ref: https://github.com/agentgateway/agentgateway/pull/4044 -->
- **MCP request outcome label**: MCP request metrics now include an `outcome` label with `success`, `tool_error`, `protocol_error`, `gateway_error`, or `unknown`, so that you can count tool failures that still return HTTP `200`. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4182 -->

### Security {#v18-security}

- **GCP tokens in backend credential lists**: Backend authentication credential lists can now fetch a Google Cloud access token or ID token with `credentials[].gcp`. Use this field to send the generated Google token in a header such as `Proxy-Authorization` while another backend authentication method preserves the client's `Authorization` header. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4279 -->

<!-- Held for the 1.8 release cut, triaged as no entry. Restore or delete then:
### MCP {#v18-mcp}
- **Configurable MCP Apps UI URI delimiter**: You can set `AGENTGATEWAY_MCP_UI_URI_DELIMITER` to use `_`, `-`, `.`, or `~` between the target name and UI resource path when an MCP host rejects the default `+` delimiter. For more information, see [MCP Apps](/documentation/mcp/apps/). (ref: https://github.com/agentgateway/agentgateway/pull/4200)
-->

## 🐛 Fixes {#v18-fixes}

**Traffic management**

- Direct responses now keep the reason from the component that produced them, MCP backend external authorization denials return the authorization service's response instead of `500`, ExtProc response-phase `ImmediateResponse` replies are returned to clients, and buffer-limit or CSRF rejections include client-safe response bodies. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4250 -->
- DNS resolution uses agentgateway's resolver cache without Hickory's internal cache layer, so hostname refreshes follow agentgateway's refresh and retry behavior. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4302 -->
- gRPC clients now receive `UNAVAILABLE` for missing services, invalid backend types, and missing backends, so retryable backend-routing errors no longer fall back to `UNKNOWN`. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4226 -->
- HTTP/2 connection handoff avoids a deadlock when a waiting request is canceled as the pool delivers a connection. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4323 -->
- HTTP/2 requests waiting for backend connection capacity are woken to retry when a peer lowers and then restores its stream limit, instead of waiting while slots are available. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4326 -->
- Parent references that use a route kind a Gateway listener does not allow now report the rejecting parent and listener, plus the route kinds that the listener allows. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4290 -->
- When an HTTP/2 server advertises a smaller stream limit than expected, the pool opens another connection instead of queuing the next request behind the full connection. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4273 -->
- When the downstream client disconnects, external processing now cancels its in-flight callout requests and stops reading a streamed upstream response body. Previously, a request that waited in an endpoint picker queue, such as in llm-d, kept its queue slot until the callout timed out, and a streamed model response kept generating until `max_tokens`. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4174 --> <!-- ref: https://github.com/agentgateway/agentgateway/pull/4285 -->
- Routes and listeners match request hostnames case-insensitively, and forwarded requests keep the original `Host` header casing. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4233 -->

**LLM**

- Bedrock conversion now sends inline OpenAI file content and base64 Anthropic document content as Bedrock document blocks. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4199 -->
- Bedrock Invoke streaming responses contribute input, output, cache-write, and cache-read token counts from `amazon-bedrock-invocationMetrics` to LLM usage metrics and cost calculations. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4297 -->
- Bedrock Mantle chat requests for `gpt-*` and `openai.gpt-*` models send token limits as `max_completion_tokens`, including when the client uses `max_tokens`. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4310 -->
- Buffered Chat Completions responses that omit the top-level `model` field now keep the request model during parsing and format conversion. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4181 -->
- Chat Completions clients now receive an OpenAI-style stream error when an Anthropic stream sends an error event after partial content. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4270 -->
- GitHub Copilot embeddings requests now accept string `input`, route embedding models to `/embeddings`, and return OpenAI-compatible embeddings responses. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4240 -->
- Messages replay to Bedrock drops assistant `thinking` blocks whose `signature` is empty, so Bedrock does not receive invalid reasoning content. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4115 -->
- Bedrock requests now keep the Anthropic `thinking.display` setting, so Claude models receive `summarized` or `omitted` thinking display preferences. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4211 -->
- Gemini and Vertex AI Chat Completions requests use `thinkingLevel` for Gemini 4 and Gemma 4 models, so `reasoning_effort` no longer returns Google thinking-budget errors. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4151 -->
- Mistral reasoning responses that send `message.content` or `delta.content` as `thinking` and `text` parts pass through Chat Completions unchanged; converted Messages and Responses replies keep only the text parts. <!-- ref: https://github.com/agentgateway/agentgateway/pull/3729 -->
- Streaming LLM response transformations can read request-side CEL fields such as `llm.provider`, `llm.requestModel`, and `llm.streaming`. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4241 -->

**Operations**

- On Windows, config lookup uses `USERPROFILE`, or `HOMEDRIVE` with `HOMEPATH`, when `HOME` is unset, so the default config file can be found without passing `--config` or `--file`. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4264 -->
- PostgreSQL request-log storage now replaces NUL characters in text and JSON fields with `U+FFFD`, so a prompt, completion, or custom attribute no longer rolls back the batch. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4274 -->

**Security**

- A Gateway listener can use a cross-namespace ConfigMap CA certificate when a ReferenceGrant permits the Gateway-to-ConfigMap reference. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4315 -->
- Gateways remove the `InsecureFrontendValidationMode` condition after frontend validation no longer uses `AllowInsecureFallback`, instead of preserving the stale condition. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4320 -->
- Inline JWKS keys that omit `kid` or use symmetric `oct` keys now report `PartiallyValid` status on the {{< reuse "agw-docs/snippets/policy.md" >}}. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4291 -->
- The Kubernetes API server rejects `oauthTokenExchange.additionalParams` entries that override reserved OAuth token-exchange parameters such as `scope`, `audience`, or `client_id`. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4286 -->
- The UI Policies page now shows API key policies with the `apiKey` type. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4332 -->

**MCP**

- A2A agent cards no longer duplicate interface paths that already contain the public gateway route when a URL rewrite changes the backend path. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4329 -->
- OpenAPI-backed MCP servers now negotiate an `initialize` protocol version that supports the handshake, including for clients that request `2025-11-25`. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4328 -->
- Stdio MCP target requests honor the backend request timeout, with a 10-second default when no timeout is configured. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4305 -->

<!-- Held for the 1.8 release cut, not in the triage keep list. Restore or delete then:
- Prompt-cache markers are preserved for GPT model names that use only a major version, such as `gpt-6-luna`. (ref: https://github.com/agentgateway/agentgateway/pull/4249)
-->

**Security**

- Routes that use OAuth token exchange, including Cross App Access (ID-JAG), now return a `401` challenge when the client's subject token has expired, even when MCP fail-open routing is enabled, so that clients can refresh the token and retry. Previously, clients got HTTP `500` errors for about 60 seconds after the token expired. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4006 -->

**Operations**

- A Gateway proxy that terminates HBONE now serves its metrics endpoint to a Prometheus instance in the same mesh. Previously, metrics scrapes over HBONE failed, so no metrics were collected. For more information, see [Data plane metrics]({{< link-hextra path="/documentation/observability/metrics/dataplane/" >}}). <!-- ref: https://github.com/agentgateway/agentgateway/pull/4118 -->
- The controller no longer panics when mesh configuration changes update the deployer view for a Gateway. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4195 -->

## ✨ Highlights {#v17-highlights}

With the 1.7 release, agentgateway knows more about your models and your traffic than in previous versions. Review the following highlights, then continue to the [breaking changes](#v17-breaking-changes) section.

- **[Model metadata and service-tier costs](#v17-catalog)**: The model catalog knows each model's context window, modalities, and capabilities, and shares them through `/v1/models` and CEL. Costs reflect the service tier that served each request.
- **[New LLM APIs and providers](#v17-llm)**: Agentgateway speaks the OpenAI Decisions and TypeSafe SystemOne APIs natively and adds Perplexity and Copilot. Virtual models can choose a target by calling your own routing service.
- **[Broader guardrails](#v17-guardrails)**: Vendor guardrails support `scope`, tool output is inspected by default, and MCP traffic can be filtered with CEL.
- **[Kubernetes and operations](#v17-operations)**: HTTPS and TLS passthrough listeners can share a port, the Helm chart can skip RBAC resources, and `agctl bug-report` collects diagnostics into one archive.

## 🔥 Breaking changes {#v17-breaking-changes}

Before you upgrade, review the breaking changes. In particular, prompt guards inspect tool outputs by default, and dynamic forward proxy backends can no longer reach loopback or link-local addresses.

### Prompt guards inspect tool outputs by default {#v17-prompt-guard-scope}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3975 -->

All request prompt guards except webhooks now honor `scope`, including `openAIModeration` and `googleModelArmor`. The default request scope now also includes `ToolOutput`, so every request guard that uses the default scope also inspects tool results. Response guards still inspect `Messages` by default.

This change can produce new rejections or masking. It also increases the content that agentgateway sends to vendor guardrail APIs.

**Actions to take**: To keep the 1.6 behavior, set the scope of each guard in `spec.backend.ai.promptGuard.request` of an {{< reuse "agw-docs/snippets/policy.md" >}} explicitly.

```yaml
scope:
- SystemPrompt
- Messages
```

Webhook guards do not support `scope`. They always inspect the system prompt and messages. For more information, see [Scope]({{< link-hextra path="/documentation/llm/guardrails/overview/#scope" >}}).

### CEL header lookups return every value of a repeated header {#v17-cel-headers}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3778 -->

A CEL lookup such as `request.headers["x-example"]` now returns a list when the header appears more than once in the request. Previously, the result depended on whether agentgateway could optimize the expression internally. The same lookup could return a single value in one expression and a list in another. Expressions that read headers that appear only once are unaffected.

**Actions to take**: Review CEL expressions that read request headers that a client can repeat, such as in authorization rules and transformations. Make sure that the expressions handle a list value. A comparison such as `request.headers["x-role"] == "guest"` returns `false` for a repeated header, so a client can skip a deny rule by sending the header twice. To read the first value, use `request.headers.raw()["x-role"][0]`. For more information, see [Repeated request headers]({{< link-hextra path="/reference/cel/variables/#repeated-headers" >}}).

### Dynamic forward proxy backends cannot connect to loopback or link-local addresses {#v17-dynamic-loopback}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3889 -->

An {{< reuse "agw-docs/snippets/backend.md" >}} with `spec.dynamicForwardProxy` now rejects destinations that resolve to loopback, link-local, or unspecified addresses, such as cloud metadata servers. Agentgateway checks the address after DNS resolution and returns `503` for a rejected request.

**Actions to take**: If a dynamic forward proxy backend must reach a service that is local to the proxy, set `config.backend.allowDynamicLoopback: true` in `spec.rawConfig` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. For more information, see [Allow loopback destinations]({{< link-hextra path="/documentation/traffic-management/dfp/#allow-dynamic-loopback" >}}) and [Raw config]({{< link-hextra path="/documentation/setup/customize/options/#raw-config" >}}).

### Error responses hide internal details {#v17-error-details}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2162 -->

Error responses that the agentgateway proxy generates now carry a generic message instead of the internal cause of the error. This keeps internal details, such as signing key IDs, file paths, and upstream addresses, from being exposed to clients. The HTTP status codes are unchanged. The `error` field of the access log and the request traces still contain the full cause.

{{< reuse "agw-docs/pages/operations/client-error-messages.md" >}}

**Actions to take**: If clients, tests, or alerts parse error response bodies or match their text, update them to match the generic messages or use the status code instead. To find the cause of an error, check the proxy's access log. To return the full details to clients while you debug in a trusted environment, set the `AGENTGATEWAY_UNSAFE_EXPOSE_ERROR_DETAILS` environment variable to `true` in `spec.env` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. Do not use this setting in production. For more information, see [Client-safe error responses]({{< link-hextra path="/documentation/operations/debug/#client-safe-error-responses" >}}).

### Removed {#v17-removed}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/4072 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4080 -->

- **Messages-to-Completions preference**: The `AGENTGATEWAY_MESSAGES_PREFER_COMPLETIONS` environment variable is removed, as planned in 1.6. When a provider supports both formats, agentgateway always converts Anthropic Messages requests to the OpenAI Responses format. For an OpenAI-compatible server that does not implement `/v1/responses`, configure a `Custom` provider that declares only the `Completions` format. For more information, see [Supported formats]({{< link-hextra path="/integrations/llm/providers/custom/#supported-formats" >}}).

### Other behavior changes {#v17-behavior-changes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3864 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3661 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3932 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3809 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3812 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4029 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4002 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3964 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3925 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4011 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3802 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3873 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3897 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3793 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3957 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3992 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3953 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3831 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4090 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4091 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4168 -->

- **Proxy environment variables**: Callouts from the proxy, such as external authorization requests, guardrail requests, and AWS and Azure credential fetches, now use the `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, and `NO_PROXY` environment variables to configure a forward proxy that these requests must be routed through. In 1.6, only Google Cloud Platform (GCP) credential fetches used these variables. If you set these variables in `spec.env` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource for another purpose, callouts go through that forward proxy after you upgrade. To keep all callouts direct, set `NO_PROXY` to `*`. For more information, see [Callout proxy]({{< link-hextra path="/documentation/setup/customize/callout-proxy/" >}}).
- **Normalized service tier**: `llm.serviceTier` is now one of `standard`, `flex`, `priority`, or `reserved`, regardless of the name that the provider uses. A provider tier that agentgateway does not recognize leaves the value unset. Update CEL expressions and dashboards that compare against provider-specific values such as `default`. For more information, see [Service tiers]({{< link-hextra path="/documentation/llm/cost-controls/costs/#service-tiers" >}}).
- **`AgentgatewayModel` wildcard precedence**: An exact model name such as `openai/gpt-5.5` in an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} now wins over a wildcard such as `openai/*`, matching standalone. For more information, see [Model matching]({{< link-hextra path="/documentation/llm/models/about/#model-matching" >}}).
- **Invalid OAuth configuration**: Invalid `oauthTokenExchange` or `crossAppAccess` backend authentication no longer blocks the rest of your configuration from reaching the proxy. Only requests that use the invalid block fail, with HTTP `500` and the message `backend authentication failed`. The proxy's access log records the cause, such as `oauthTokenExchange configuration is invalid` or `crossAppAccess configuration is invalid`. The policy reports `Accepted: True` with the reason `PartiallyValid`. For more information, see [Debug your setup]({{< link-hextra path="/documentation/operations/debug/" >}}).
- **Bedrock `tool_choice` and service tier**: Client `tool_choice` settings and the OpenAI `service_tier` values now reach Bedrock Converse instead of being dropped silently. Requests that force tool use on a model that does not support it, such as with extended thinking, or that ask for a tier that the model does not support, now return an error from Bedrock. For more information, see [Service tier]({{< link-hextra path="/integrations/llm/providers/bedrock/#service-tier" >}}).
- **Token rate limits for non-chat APIs**: Token-based LLM rate limits now count usage from Embeddings, Rerank, Decisions, and SystemOne requests.
- **LLM buffer size**: The 32 MiB default LLM request buffer now applies before request policies run instead of after.
- **Webhook guardrail responses**: A webhook `pass` response that contains any field other than `reason` is now an error. So is a `mask` response whose messages contain extra fields, which previously passed the content unmasked. The error follows the guard's `failureMode`. For more information, see [Webhook response actions]({{< link-hextra path="/documentation/llm/guardrails/webhook/guardrails/#webhook-response-actions" >}}).
- **Google Model Armor errors**: A non-success response from Model Armor is now a guard failure and follows the guard's `failureMode`.
- **Backend mirrors**: Request mirror filters in the `backendRefs` of an `HTTPRoute` now run after backend policies, so requests that backend authorization rejects are no longer mirrored. Mirror filters on a route rule still run before backend policies.
- **Model namespaces**: An {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} in a namespace that the listener's `allowedRoutes.namespaces` does not allow is now `Accepted: False` with the reason `NotAllowedByListeners`. The default is `from: Same`, so a model in another namespace no longer attaches. To fix it, set `from` to `All` or `Selector`, or move the model. For more information, see [Troubleshooting]({{< link-hextra path="/documentation/llm/models/serve/#requests-return-model_not_found" >}}).
- **MCP session errors**: Stateful MCP requests with a session ID that the proxy cannot decode, such as after the session key changes, now return `404` instead of `400`. Clients then start a new session.
- **gRPC health**: Errors that agentgateway itself returns to gRPC clients now record their `grpc-status`. Only server-side gRPC errors, such as `UNAVAILABLE` or `INTERNAL`, mark a backend unhealthy. A client-side gRPC status from an LLM provider no longer evicts the target from a failover group. This change matches how agentgateway treats `5xx` and `4xx` responses for HTTP.
- **gRPC policy calls**: When a gRPC policy call, such as to an external processing server, fails before it reaches the service, agentgateway now reports the mapped gRPC status instead of `UNKNOWN`. For example, DNS errors, refused connections, and timeouts report `UNAVAILABLE`.
- **Anthropic version header**: Agentgateway forwards the client's `anthropic-version` header instead of replacing it. When the client does not send the header, agentgateway still sets the default value `2023-06-01`.
- **Controller reconciliation metrics**: The controller no longer reports `agentgateway_controller_reconcile_duration_seconds` or `agentgateway_controller_reconciliations_running`. `agentgateway_controller_reconciliations_total` reports only the controller and result, without the `name` and `namespace` labels. Update dashboards and alerts that use these metrics. For more information, see [Control plane metrics reference]({{< link-hextra path="/documentation/observability/metrics/control-plane/#control-plane-metrics-reference" >}}).
- **Configuration warning Events**: Configuration warnings in the proxy's xDS responses now publish Kubernetes Events with the reason `AgentGatewayConfigWarning` and increment `agentgateway_xds_warnings_total`. Warnings do not count the response as rejected. In 1.6, these warnings were reported as rejections, with the `AgentGatewayNackError` reason and the `agentgateway_xds_rejects_total` counter. If your alerts watch for rejections, also alert on warnings. For more information, see [View configuration warnings]({{< link-hextra path="/documentation/observability/metrics/nacks/#config-warnings" >}}).
- **GenAI operation name**: The `gen_ai.operation.name` attribute in access logs and traces now reflects the request type, such as `generate_content`, `embeddings`, `rerank`, `realtime`, `decisions`, or `count_tokens`. Requests on a route with the `Detect` route type record the operation that the request path implies, such as `ocr` or `image_generation`, or `unknown` for a path that agentgateway does not recognize. In 1.6, every request except Embeddings requests recorded `chat`. Update queries and dashboards that filter on `chat`. For more information, see [Operation names]({{< link-hextra path="/documentation/observability/traces/attribute-reference/#operation-names" >}}).
- **CSRF `Origin` checks**: For a request without a `Sec-Fetch-Site` header, the CSRF policy now rejects `Origin: null` unless `additionalOrigins` includes `null`. In 1.6, agentgateway treated `Origin: null` as a missing origin and allowed the request. The same-origin check now compares only the host and ignores the scheme, so a TLS-terminating proxy in front of agentgateway no longer causes false rejections. For more information, see [CSRF]({{< link-hextra path="/documentation/security/csrf/" >}}).
- **Chat Completions streams always include usage**: Streamed Chat Completions replies now always end with a usage chunk before `data: [DONE]`, and you cannot turn this chunk off. In 1.6, setting `stream_options.include_usage` to `false` turned off the usage chunk. Make sure that your client code handles the usage chunk. The usage chunk has an empty `choices` array, so code that reads `choices[0]` from every chunk throws an error when it reaches the usage chunk. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4156 -->

## 🌟 New features {#v17-new-features}

### LLM APIs and providers {#v17-llm}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3832 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3839 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3852 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3854 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3928 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4018 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3771 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3605 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3843 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4030 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3828 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3776 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4010 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3912 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4152 -->

- **OpenAI Decisions and TypeSafe SystemOne**: Agentgateway supports the OpenAI Decisions and TypeSafe SystemOne APIs natively and translates between them. Set `spec.provider: Typesafe` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} to connect to TypeSafe. For more information, see [Decisions]({{< link-hextra path="/documentation/llm/api-types/decisions/" >}}) and [TypeSafe]({{< link-hextra path="/integrations/llm/providers/typesafe/" >}}).
- **Perplexity provider**: Set `spec.provider: Perplexity` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} to connect to Perplexity with built-in defaults. The provider accepts Responses and Messages requests, but not Chat Completions requests. For other ways to connect, see [Perplexity]({{< link-hextra path="/integrations/llm/providers/perplexity/" >}}).
- **Copilot on Kubernetes**: Set `spec.ai.provider.copilot` on an {{< reuse "agw-docs/snippets/backend.md" >}}, or `spec.provider: Copilot` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}, to use the Copilot provider with credentials from a Kubernetes Secret. For more information, see [Copilot]({{< link-hextra path="/integrations/llm/providers/copilot/" >}}).
- **Callout router for virtual models**: A virtual model can select its target model by calling an external HTTP service. Set `spec.virtualModel.callout` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}, with an optional fallback model and response cache. For more information, see [Choose a model with an HTTP callout]({{< link-hextra path="/documentation/llm/models/virtual/#callout-routing" >}}).
- **Better format conversion**: Reasoning from vLLM, OpenRouter, and Bedrock is preserved in more conversions. Chat Completions requests to Anthropic send inline `file` parts as documents instead of dropping them, and a file part without inline data, such as a `file_id`, returns `400`. For more information, see [Encrypted reasoning]({{< link-hextra path="/integrations/llm/providers/bedrock/#encrypted-reasoning" >}}).
- **More CEL during request policies**: Request-phase CEL expressions on LLM traffic can read `llm.requestModel` before provider overrides and `llmRequest` for the parsed JSON request body. For more information, see [Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}).
- **Audio endpoints**: Agentgateway detects `/v1/audio/transcriptions`, `/v1/audio/translations`, and `/v1/audio/speech` requests, so that policies, logs, and metrics apply to audio traffic. Transcription and translation requests record `audio_seconds` and can be priced per audio minute with the new `perAudioMinute` catalog rate. In CEL, read `llm.audioSeconds`, `llm.costRates.perAudioMinute`, and `llm.cost.audioDuration`. The built-in catalog includes per-minute rates for some OpenAI transcription models, such as `whisper-1`. Speech requests are not metered. For more information, see [Audio models]({{< link-hextra path="/integrations/llm/providers/audio/" >}}).

### Model catalog and cost {#v17-catalog}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3960 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4016 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3965 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3981 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3661 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3825 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3977 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4088 -->

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

  For more information, see [Verify model discovery]({{< link-hextra path="/documentation/llm/models/serve/#verify-model-discovery" >}}).
- **Model metadata in CEL**: The catalog entry of the model that served a request is available in CEL as `llm.model`, such as `llm.model.limits.context`. Agentgateway sets `llm.model` when it calculates the cost of the response. The value is unset when the model has no catalog entry. For more information, see [Use cost data in CEL, logs, traces, and metrics]({{< link-hextra path="/documentation/llm/cost-controls/costs/#step-4-use-cost-data-in-cel-logs-traces-and-metrics" >}}).
- **Service-tier pricing**: Pricing now accounts for the service tier that served each request. Agentgateway records the tier as `llm.serviceTier` for OpenAI, Azure, Anthropic, Bedrock, Vertex AI, and Gemini. A catalog pricing tier can set `serviceTier` alongside `contextOver`, so that flex or priority requests are priced at their actual rates. The built-in catalog includes service-tier prices for models such as those from OpenAI, Azure, and Vertex AI, and `agctl catalog import` adds Vertex AI Gemini tier rates from its default `vertex-pricing` source. You can configure rates for other models in the catalog JSON of a ConfigMap that `spec.modelCatalog` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource references.

  ```json
  "tiers": [
    {"serviceTier": "priority", "rates": {"input": "2.5", "output": "15"}},
    {"serviceTier": "priority", "contextOver": 272000, "rates": {"input": "5", "output": "22.5"}}
  ]
  ```

  For more information, see [Catalog JSON format]({{< link-hextra path="/documentation/llm/cost-controls/costs/#catalog-json-format" >}}).
- **1-hour and 12-hour cache pricing**: Cache writes with a longer time to live (TTL), such as Anthropic 1-hour and OpenAI 12-hour cache writes, are priced with the new `cacheWriteDetails` rates, keyed by TTL such as `1h` and `12h`. When a TTL has no rate, the `cacheWrite` rate applies. In CEL, read the cost of a TTL with brackets, such as `llm.cost.cacheWriteDetails['1h']`. For more information, see [Catalog JSON format]({{< link-hextra path="/documentation/llm/cost-controls/costs/#catalog-json-format" >}}).

### Guardrails {#v17-guardrails}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3732 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3810 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3830 -->

- **Reasoning and response scope**: Guards scan plaintext reasoning and thinking content as part of the `Messages` scope. Response prompt guards support `scope`. For more information, see [Scope]({{< link-hextra path="/documentation/llm/guardrails/overview/#scope" >}}).
- **Rejection headers**: A prompt guard's rejection response can add headers. Set `response.headers` on the guard. For more information, see [Customize rejection responses]({{< link-hextra path="/documentation/llm/guardrails/overview/#customize-rejection-responses" >}}).
- **CEL processor for MCP guardrails**: Set `spec.backend.mcp.guardrails.processors[].expression` on an {{< reuse "agw-docs/snippets/policy.md" >}} to reject or transform MCP requests and responses with CEL. No external policy server is required.

  ```yaml
  backend:
    mcp:
      guardrails:
        processors:
        - methods:
            tools/call: Request
          expression:
            condition: mcp.params.name == 'restricted_tool'
            reject: "This tool is unavailable"
  ```

  For more information, see [Set up CEL guardrails]({{< link-hextra path="/documentation/mcp/guardrails/cel/" >}}).

### Security {#v17-security}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3936 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3864 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3763 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4158 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4147 -->

- **MCP authorization without an ID**: Agentgateway now rejects MCP requests other than `notifications/*` that have no usable JSON-RPC `id` with `400`. In 1.6, a `tools/call` without an `id` reached the MCP server without MCP authorization. For more information, see [Tool access]({{< link-hextra path="/documentation/mcp/tool-access/" >}}).
- **MCP authentication with token passthrough**: MCP authentication now works with a JWT policy that sets `spec.traffic.jwtAuthentication.preserveToken: true`. For more information, see [Set up JWT authentication]({{< link-hextra path="/documentation/security/jwt/setup/" >}}).
- **Callouts through a proxy**: You can now send the requests that the agentgateway proxy makes on its own behalf, such as external authorization requests, guardrail requests, and cloud provider credential fetches, through a forward proxy. For more information, see [Callout proxy]({{< link-hextra path="/documentation/setup/customize/callout-proxy/" >}}).
- **Optional chart-created RBAC**: Set `rbac.create` to `false` in the controller Helm chart to skip the ClusterRoles, Role, ClusterRoleBindings, and RoleBindings that the chart creates, for clusters that manage role-based access control (RBAC) outside of Helm. For more information, see [Chart-created RBAC resources]({{< link-hextra path="/documentation/install/advanced/#rbac-create" >}}).
- **ClusterTrustBundle CA certificates**: A BackendTLSPolicy or a listener with `frontendValidation` can read CA certificates from an experimental ClusterTrustBundle, on Kubernetes 1.37 and later. If you set `rbac.create` to `false`, grant the controller `get`, `list`, and `watch` on `clustertrustbundles`. For more information, see [CA certificate in a ClusterTrustBundle]({{< link-hextra path="/documentation/security/backendtls/#clustertrustbundle-ca" >}}) and [Listener mTLS]({{< link-hextra path="/documentation/setup/listeners/mtls/#ca-sources" >}}).

### Observability {#v17-observability}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3850 -->

- **Agent sessions**: Agentgateway detects the agent session that a request belongs to from well-known agent headers, such as `x-claude-code-session-id`. CEL expressions can read the session ID as `request.agent.session`. For more information, see [Agent sessions]({{< link-hextra path="/reference/cel/variables/#agent-sessions" >}}).

### MCP {#v17-mcp}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3824 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4060 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4062 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3976 -->

- **Conditional virtual MCP targets**: Set `spec.mcp.targets[].condition` on an {{< reuse "agw-docs/snippets/backend.md" >}} to a CEL expression that selects which targets take part in a request. For more information, see [Include targets conditionally]({{< link-hextra path="/documentation/mcp/virtual/#target-conditions" >}}).
- **Session cleanup across replicas**: Closing a stateful MCP session now resumes the encoded session before agentgateway closes the upstream sessions. Any replica with the same session key can close the upstream sessions.

### Kubernetes and operations {#v17-operations}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/4000 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3797 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3833 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3991 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3634 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4020 -->

- **Shared HTTPS and TLS ports**: HTTPS and TLS passthrough listeners on the same Gateway can share a port. Agentgateway selects the listener by SNI hostname. For more information, see [Share the HTTPS port with a TLS passthrough listener]({{< link-hextra path="/documentation/setup/listeners/https/#tls-passthrough-shared-port" >}}).
- **Native histogram scraping**: In the controller Helm chart, the controller ServiceMonitor (`monitoring.serviceMonitor`) and the proxy PodMonitor (`monitoring.proxy.podMonitor`) support native histogram scraping, relabelings, and metric relabelings. Native histogram scraping is off by default and requires Prometheus v3.8.0 or later and Prometheus Operator v0.88.0 or later. For more information, see [Scrape native histograms]({{< link-hextra path="/documentation/observability/metrics/overview/#native-histograms" >}}).
- **Graceful HTTP/1 drain**: When a proxy drains or a connection reaches its maximum connection duration, HTTP/1 clients receive `Connection: close` on the next response, so that they close the connection cleanly.
- **`agctl bug-report`**: Collect cluster resources, logs, and metrics into a single archive to share for troubleshooting. For more information, see [Collect a bug report]({{< link-hextra path="/documentation/operations/debug/#bug-report" >}}).
- **Client Setup in the UI**: The UI can generate LLM client settings for the models that your Gateway serves, including a recipe for Continue. For more information, see [Generate LLM client settings]({{< link-hextra path="/documentation/observability/ui/#client-setup" >}}).

## 🐛 Fixes {#v17-fixes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3773 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3721 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3759 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3764 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3853 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3920 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3676 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3899 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3893 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3802 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3786 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3894 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4057 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4050 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4067 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4096 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4059 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3966 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4105 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3898 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4157 -->

**Traffic management**

- CEL calls such as `contains(a, b)`, `startsWith`, `endsWith`, and `matches` now read the second argument. Previously, they ignored it, so `contains(x, y)` always returned `true`.
- A policy that targets the endpoint picker (EPP) Service of an InferencePool now attaches, so you can raise the 10-second EPP timeout. For more information, see [Raise the endpoint picker timeout]({{< link-hextra path="/documentation/llm/inference/inference-routing/#epp-timeout" >}}).
- An {{< reuse "agw-docs/snippets/policy.md" >}} that sets retry `attempts: 0` now disables retries. Previously, an explicit `0` gave one retry. <!-- ref: https://github.com/agentgateway/agentgateway/pull/4180 -->
<!-- Held for the 1.8 release cut, not in the triage keep list. Restore or delete then:
- External authorization and rate-limit trace logs no longer include response header, query-parameter, or body values that might contain credentials. (ref: https://github.com/agentgateway/agentgateway/pull/4139)
- Substrate TLS passthrough egress that does not match an allowed destination is blocked at ClientHello instead of completing TLS and returning HTTP `403`. (ref: https://github.com/agentgateway/agentgateway/pull/4093)
-->

**LLM**

- Usage and cost now include the reasoning tokens of OpenAI-compatible responses, such as from Gemini, the input and cache tokens of streamed Anthropic responses on `Detect` routes, and every iteration of Anthropic responses that report `usage.iterations`, such as for server-side compaction. Previously, these tokens were not counted.
- Bedrock conversion keeps prompt-cache markers when it drops unsupported content, passes Anthropic cache TTLs to Bedrock cache points, and no longer invalidates the prompt cache on mid-stream system messages.
- Built-in OpenAI-compatible providers, such as Groq and DeepInfra, no longer duplicate the base path, such as `/v1/v1/...`, on Detect and Passthrough routes.
- Gemini tool schemas that use `oneOf` no longer return empty tool calls. Messages and Responses requests keep the Gemini 3 thought signature, so tool loops no longer fail with `400`.
- Passthrough no longer fails on SSE streams with an unterminated final event.
- Claude models on Azure AI Foundry now follow the Anthropic prompt-cache token convention for normalized token counts and cost.
- The built-in model catalog keeps deprecated models that providers still serve, so that requests to these models are still priced. `agctl catalog import` now includes deprecated models by default. To leave them out, set `--legacy=false`.

**MCP**

- Backend authorization rules for MCP requests evaluate transformed tool names after route-level body transformations run.
- The controller creates the session key Secret of each Gateway only when the Secret is missing, and no longer overwrites the key on reconcile, which could invalidate stateful MCP sessions. If the Secret cannot be created, the Gateway reports `Programmed: False` with the reason `DeploymentFailed`.
- MCP streamable HTTP `POST` requests can list `application/json` and `text/event-stream` in separate `Accept` header lines instead of one comma-separated value.
- MCP responses now honor the `spec.traffic.timeouts.responseIdle` response idle timeout, which previously did not apply on MCP routes. A response, including an SSE stream, that sends no data for longer than the timeout is now ended.
- A configuration reload that races with MCP session creation no longer hangs the proxy.
- Reused stateful MCP sessions now apply the MCP guardrails of the current route, as they already did for MCP authorization. A request with an encrypted session ID that a different MCP backend issued returns `404`, and the client starts a new session. Previously, a session could skip the guardrails of another route or reach another backend.
