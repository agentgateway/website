---
title: Release notes
weight: 20
description: What's new, changed, and fixed in each agentgateway on Kubernetes release.
test: skip
---

Review the release notes for agentgateway on Kubernetes.

> [!NOTE]
> For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).

## ✨ Highlights {#v17-highlights}

Version 1.7 knows more about your models and your traffic. Review the following highlights. Before you upgrade, also review the [breaking changes](#v17-breaking-changes), because several defaults change.

- **[Model metadata and service-tier costs](#v17-catalog)**: The model catalog knows each model's context window, modalities, and capabilities, and shares them through `/v1/models` and CEL. Costs reflect the service tier that served each request.
- **[New LLM APIs and providers](#v17-llm)**: Agentgateway speaks the OpenAI Decisions and TypeSafe SystemOne APIs natively and adds Perplexity and Copilot. Virtual models can choose a target by calling your own routing service.
- **[Broader guardrails](#v17-guardrails)**: Vendor guardrails support `scope`, tool output is inspected by default, and MCP traffic can be filtered with CEL.
- **[Kubernetes and operations](#v17-operations)**: HTTPS and TLS passthrough listeners can share a port, the Helm chart can skip RBAC resources, and the controller does less work when unrelated resources change.

## 🔥 Breaking changes {#v17-breaking-changes}

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

### CEL lookups of a repeated request header return every value {#v17-cel-headers}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3778 -->

A CEL lookup such as `request.headers["x-example"]` now returns a list when the header appears more than once in the request. Previously, the result depended on whether agentgateway could optimize the expression internally. The same lookup could return a single value in one expression and a list in another. Expressions that read headers that appear only once are unaffected.

**Actions to take**: Review CEL expressions that read request headers that a client can repeat, such as in authorization rules and transformations. Make sure that the expressions handle a list value. For more information, see [CEL variables]({{< link-hextra path="/reference/cel/variables/" >}}).

### Dynamic forward proxy backends cannot connect to loopback or link-local addresses {#v17-dynamic-loopback}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3889 -->

An {{< reuse "agw-docs/snippets/backend.md" >}} with `spec.dynamicForwardProxy` now rejects destinations that resolve to loopback, link-local, or unspecified addresses, such as cloud metadata servers. Agentgateway checks the address after DNS resolution and returns `503` for a rejected request.

**Actions to take**: If a dynamic forward proxy backend must reach a service that is local to the proxy, set `config.backend.allowDynamicLoopback: true` in `spec.rawConfig` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. For more information, see [Dynamic forward proxy]({{< link-hextra path="/documentation/traffic-management/dfp/" >}}) and [Raw config]({{< link-hextra path="/documentation/setup/customize/options/#raw-config" >}}).

## ⚠️ Removed {#v17-removed}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/4072 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4080 -->

The `AGENTGATEWAY_MESSAGES_PREFER_COMPLETIONS` environment variable is removed, as planned in 1.6. When a provider supports both formats, agentgateway always converts Anthropic Messages requests to the OpenAI Responses format. For an OpenAI-compatible server that does not implement `/v1/responses`, configure a `Custom` provider that declares only the `Completions` format. For more information, see [Supported formats]({{< link-hextra path="/integrations/llm/providers/custom/#supported-formats" >}}).

## 🔄 Other behavior changes {#v17-behavior-changes}

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

- **Proxy environment variables**: Callouts from the proxy, such as external authorization requests, guardrail requests, and AWS and Azure credential fetches, now use the `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, and `NO_PROXY` environment variables to configure a forward proxy that these requests must be routed through. In 1.6, only Google Cloud Platform (GCP) credential fetches used these variables. If you set these variables in `spec.env` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource for another purpose, callouts go through that forward proxy after you upgrade. To keep all callouts direct, set `NO_PROXY` to `*`. For more information, see [Callout proxy]({{< link-hextra path="/documentation/setup/customize/callout-proxy/" >}}).
- **Normalized service tier**: `llm.serviceTier` is now one of `standard`, `flex`, `priority`, or `reserved`, whatever the provider's own naming. A provider tier that agentgateway does not recognize leaves the value unset. Update CEL expressions and dashboards that compare against provider-specific values such as `default`.
- **`AgentgatewayModel` wildcard precedence**: An exact model name such as `openai/gpt-5.5` in an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} now wins over a wildcard such as `openai/*`, matching standalone. For more information, see [Model matching]({{< link-hextra path="/documentation/llm/models/about/#model-matching" >}}).
- **Invalid OAuth configuration**: Invalid `oauthTokenExchange` or `crossAppAccess` backend authentication no longer blocks the rest of your configuration from reaching the proxy. Only requests that use the invalid block fail, with HTTP `500` and the message `oauthTokenExchange configuration is invalid` or `crossAppAccess configuration is invalid`. The policy reports `Accepted: True` with the reason `PartiallyValid`. For more information, see [Debug your setup]({{< link-hextra path="/documentation/operations/debug/" >}}).
- **Bedrock `tool_choice`**: Client `tool_choice` settings now reach Bedrock Converse as `toolChoice`. Previously, they were dropped silently. Requests that force tool use on a model that does not support it, such as with extended thinking, now return an error from Bedrock.
- **Token rate limits for non-chat APIs**: Token-based LLM rate limits now count usage from Embeddings, Rerank, Decisions, and SystemOne requests.
- **LLM buffer size**: The 32 MiB default LLM request buffer now applies before request policies run instead of after.
- **Webhook guardrail responses**: A webhook `pass` response that contains any field other than `reason` is now an error instead of passing the content unmasked. The error follows the guard's `failureMode`.
- **Google Model Armor errors**: A non-success response from Model Armor is now a guard failure and follows the guard's `failureMode`.
- **Backend mirrors**: Request mirror filters in the `backendRefs` of an `HTTPRoute` now run after backend policies, so requests that backend authorization rejects are no longer mirrored. Mirror filters on a route rule still run before backend policies.
- **MCP session errors**: Stateful MCP requests with a session ID that the proxy cannot decode, such as after the session key changes, now return `404` instead of `400`. Clients then start a new session.
- **gRPC health**: Errors that agentgateway itself returns to gRPC clients now record their `grpc-status`. Only server-side gRPC errors, such as `UNAVAILABLE` or `INTERNAL`, mark a backend unhealthy. A client-side gRPC status from an LLM provider no longer evicts the target from a failover group. This change matches how agentgateway treats `5xx` and `4xx` responses for HTTP.
- **gRPC policy calls**: When a gRPC policy call, such as to an external processing server, fails before it reaches the service, agentgateway now reports the mapped gRPC status instead of `UNKNOWN`. For example, DNS errors, refused connections, and timeouts report `UNAVAILABLE`.
- **Anthropic version header**: Agentgateway forwards the client's `anthropic-version` header instead of replacing it. When the client does not send the header, agentgateway still sets the default value `2023-06-01`.
- **Controller reconciliation metrics**: The controller no longer reports `agentgateway_controller_reconcile_duration_seconds` or `agentgateway_controller_reconciliations_running`. `agentgateway_controller_reconciliations_total` reports only the controller and result, without the `name` and `namespace` labels. Update dashboards and alerts that use these metrics.
- **Configuration warning Events**: Configuration warnings in the proxy's xDS responses now publish Kubernetes Events with the reason `AgentGatewayConfigWarning` and increment `agentgateway_xds_warnings_total`. Warnings do not count the response as rejected.

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
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3691 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4010 -->

- **OpenAI Decisions and TypeSafe SystemOne**: Agentgateway supports the OpenAI Decisions API and the TypeSafe SystemOne API natively, and translates between them in both directions. Route `/v1/decisions` and `/v1/systemone` with the `Decisions` and `SystemOne` route types of an {{< reuse "agw-docs/snippets/backend.md" >}}. To connect to TypeSafe, set `spec.provider: Typesafe` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}. For more information, see [Decisions]({{< link-hextra path="/documentation/llm/api-types/decisions/" >}}) and [TypeSafe]({{< link-hextra path="/integrations/llm/providers/typesafe/" >}}). Azure supports both APIs for the `Foundry` resource type.
- **Perplexity provider**: Set `spec.provider: Perplexity` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} to connect to Perplexity with built-in defaults. The provider accepts Responses and Messages requests, but not Chat Completions requests. For other ways to connect, see [OpenAI-compatible providers]({{< link-hextra path="/integrations/llm/providers/openai-compatible/#perplexity" >}}).
- **Copilot on Kubernetes**: Set `spec.ai.provider.copilot` on an {{< reuse "agw-docs/snippets/backend.md" >}}, or `spec.provider: Copilot` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}, to use the Copilot provider with credentials from a Kubernetes Secret. For more information, see [Copilot]({{< link-hextra path="/integrations/llm/providers/copilot/" >}}).
- **Callout router for virtual models**: A virtual model can select its target model by calling an external HTTP service. Set `spec.virtualModel.callout` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}, with an optional fallback model and response cache. For more information, see [Choose a model with an HTTP callout]({{< link-hextra path="/documentation/llm/models/virtual/#callout-routing" >}}).
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
- **Service-tier pricing**: Agentgateway records the service tier that served each request as `llm.serviceTier` for OpenAI, Azure, Anthropic, Bedrock, Vertex AI, and Gemini. A catalog pricing tier can set `serviceTier` alongside `contextOver`, so that flex or priority requests are priced at their actual rates. The built-in catalog includes service-tier prices for models such as those from OpenAI, Azure, and Vertex AI, and `agctl catalog import` adds Vertex AI Gemini tier rates from its default `vertex-pricing` source. You can configure rates for other models in the catalog JSON of a ConfigMap that `spec.modelCatalog` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource references.

  ```json
  "tiers": [
    {"serviceTier": "priority", "rates": {"input": "2.5", "output": "15"}},
    {"serviceTier": "priority", "contextOver": 272000, "rates": {"input": "5", "output": "22.5"}}
  ]
  ```

  For more information, see [Catalog JSON format]({{< link-hextra path="/documentation/llm/cost-controls/costs/#catalog-json-format" >}}).
- **1-hour cache pricing**: Anthropic cache writes with a 1-hour TTL are priced with the new `cacheWrite1h` rate. When the rate is unset, the `cacheWrite` rate applies.

### Guardrails {#v17-guardrails}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3975 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3732 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3810 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3830 -->

- **Scope for vendor guardrails**: The `openAIModeration` and `googleModelArmor` guards support `scope`, like the `regex` and `bedrockGuardrails` guards. For the change to the default scope, see [Prompt guards inspect tool outputs by default](#v17-prompt-guard-scope).
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

- **MCP authentication with token passthrough**: MCP authentication now works with a JWT policy that sets `spec.traffic.jwtAuthentication.preserveToken: true`. For more information, see [Set up JWT authentication]({{< link-hextra path="/documentation/security/jwt/setup/" >}}).
- **Callout proxy**: You can now send the requests that the agentgateway proxy makes on its own behalf, such as external authorization requests, guardrail requests, and cloud provider credential fetches, through a forward proxy. For more information, see [Callout proxy]({{< link-hextra path="/documentation/setup/customize/callout-proxy/" >}}).
- **Optional chart-created RBAC**: Set `rbac.create` to `false` in the controller Helm chart to skip the ClusterRoles, Role, ClusterRoleBindings, and RoleBindings that the chart creates, for clusters that manage role-based access control (RBAC) outside of Helm. For more information, see [Chart-created RBAC resources]({{< link-hextra path="/documentation/install/advanced/#rbac-create" >}}).

### Observability {#v17-observability}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3850 -->

- **Agent session detection**: Agentgateway detects the agent session that a request belongs to from well-known agent headers, such as `x-claude-code-session-id`. CEL expressions can read the session ID as `request.agent.session`. For more information, see [Agent sessions]({{< link-hextra path="/reference/cel/variables/#agent-sessions" >}}).

### MCP {#v17-mcp}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3824 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3976 -->

- **Conditional virtual MCP targets**: Set `spec.mcp.targets[].condition` on an {{< reuse "agw-docs/snippets/backend.md" >}} to a CEL expression to select which targets take part in a request before agentgateway initializes or contacts them. A backend whose only target is a `static` target cannot set a condition. For more information, see [Include targets conditionally]({{< link-hextra path="/documentation/mcp/virtual/#target-conditions" >}}).
- **Session cleanup across replicas**: Closing a stateful MCP session now resumes the encoded session before agentgateway closes the upstream sessions. Any replica with the same session key can close the upstream sessions.

### Kubernetes and operations {#v17-operations}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/4000 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3797 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3833 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4017 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3883 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3885 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3991 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3634 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4020 -->

- **Shared HTTPS and TLS ports**: HTTPS and TLS passthrough listeners on the same Gateway can share a port. Agentgateway selects the listener by SNI hostname.
- **Native histogram scraping**: In the controller Helm chart, the controller ServiceMonitor (`monitoring.serviceMonitor`) and the proxy PodMonitor (`monitoring.proxy.podMonitor`) support native histogram scraping, relabelings, and metric relabelings. Native histogram scraping is off by default and requires Prometheus v3.8.0 or later and Prometheus Operator v0.88.0 or later. For more information, see [Scrape native histograms]({{< link-hextra path="/documentation/observability/metrics/overview/#native-histograms" >}}).
- **Graceful HTTP/1 drain**: When a proxy drains or a connection reaches its maximum connection duration, HTTP/1 clients receive `Connection: close` on the next response, so that they close the connection cleanly.
- **Faster controller**: The controller does less work when unrelated resources change. Status and xDS output are more stable, which reduces unnecessary writes and pushes.
- **`agctl bug-report`**: Collect cluster resources, logs, and metrics into a single archive to share for troubleshooting. For more information, see [Collect a bug report]({{< link-hextra path="/documentation/operations/debug/#bug-report" >}}).
- **Client Setup in the UI**: The UI can generate LLM client settings for the models that your Gateway serves, including a recipe for Continue. For more information, see [Generate LLM client settings]({{< link-hextra path="/documentation/observability/ui/#client-setup" >}}).

## 🐛 Fixes {#v17-fixes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3996 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3744 -->
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
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3572 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3817 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3746 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3896 -->

**Traffic management**

- Requests that agentgateway answers locally, such as for an unknown model or a failed model authorization, now include the request data in access logs and CEL.

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

**MCP**

- Backend authorization rules for MCP requests evaluate transformed tool names after route-level body transformations run.
- The controller creates the session key Secret of each Gateway only when the Secret is missing, and no longer overwrites the key on reconcile, which could invalidate stateful MCP sessions. If the Secret cannot be created, the Gateway reports `Programmed: False` with the reason `DeploymentFailed`.
- MCP streamable HTTP `POST` requests can list `application/json` and `text/event-stream` in separate `Accept` header lines instead of one comma-separated value.
- MCP responses now honor the `spec.traffic.timeouts.responseIdle` response idle timeout, which previously did not apply on MCP routes. A response, including an SSE stream, that sends no data for longer than the timeout is now ended.
- Resumed MCP sessions no longer keep outdated settings after a configuration change.

**Operations**

- Policies that target a Gateway that agentgateway does not manage are no longer reported as attached.
- The controller no longer resets the Istio log level.
- Metrics requests use the OpenMetrics content type by default, while browser requests use `text/plain` so browsers display metrics instead of downloading them.

## ✨ Highlights {#v16-highlights}

Version 1.6 provides many updates to existing features, including the following quick highlights. Before you upgrade, review the [breaking changes](#v16-breaking-changes), because several defaults change.

- **[`AgentgatewayModel` is on by default](#v16-llm)**: The model-centric API is no longer experimental, so you can serve LLMs without a Helm flag.
- **[More resilient LLM routing](#v16-llm)**: Failover evicts unhealthy targets automatically, a virtual model with one broken target keeps serving, and a new idle timeout catches backends that stall mid-stream.
- **[Authentication improvements](#v16-security)**: JWT providers are selected by issuer and key ID, `requiredClaims` sets which claims a token must carry, and AWS and Azure backend authentication gain `externalId` and `scopes`.
- **[Session affinity](#v16-traffic)**: Send the requests that share a value, such as a session header, to the same endpoint.

## 🔥 Breaking changes {#v16-breaking-changes}

### Anthropic Messages requests convert to the Responses format {#v16-messages-responses}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3647 -->

Agentgateway now prefers the OpenAI Responses format when it converts Anthropic Messages requests. In 1.5, it preferred Chat Completions. This change applies to these providers:

- `OpenAI`, `Ollama`, `Groq`, `Huggingface`, and `XAI`
- `Azure` for models other than Claude
- `Custom` providers that declare both `Responses` and `Completions`

The Responses conversion drops extended-thinking history. The Chat Completions conversion preserves it.

**Actions to take**: Use the `OpenAI` provider only for the OpenAI API. For other OpenAI-compatible servers, use a `Custom` provider with the formats that the server supports. If the server does not support `/v1/responses`, declare only `Completions`. Also declare only `Completions` if your clients need extended-thinking history.

Use `AGENTGATEWAY_MESSAGES_PREFER_COMPLETIONS=true` only to work around a Responses conversion bug with a provider that supports both formats. Set this environment variable in `spec.env` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. The variable is removed in 1.7. For more information, see [Supported formats]({{< link-hextra path="/integrations/llm/providers/custom/#supported-formats" >}}).

### Built-in model catalog for default request pricing {#v16-built-in-catalog}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3191 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3669 -->

Agentgateway now includes a built-in model cost catalog. Requests to common public models have a cost in logs, traces, metrics, and CEL without extra configuration. In 1.5, you had to configure a catalog to calculate costs. Cost-based CEL expressions, such as rate limits that use `llm.cost`, now apply to these models.

**Actions to take**: Review your cost-based policies and CEL expressions. If you already configure a catalog, you can remove that configuration. To customize rates, add an overlay to the built-in catalog. For more information, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}).

### A `baseURL` with no path sets the base path to `/` {#v16-baseurl-base-path}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3403 -->

`spec.baseURL` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} now always sets the full base path. A URL with no path, such as `https://api.openai.com`, sets the base path to `/`. In 1.5, `Custom` and `Ollama` providers appended `/v1`. Built-in providers such as `OpenAI` forwarded the client's path.

**Actions to take**: Add the provider's API path to every `spec.baseURL` that has no path. For example, change `https://api.openai.com` to `https://api.openai.com/v1`. For Ollama, change `http://ollama.default.svc.cluster.local:11434` to `http://ollama.default.svc.cluster.local:11434/v1`. URLs that already have a path are unaffected. For more information, see [Providers]({{< link-hextra path="/documentation/llm/models/about/#providers" >}}).

## ⚠️ Removed {#v16-removed}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3208 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3520 -->

- **Legacy token counts**: The `AGENTGATEWAY_LEGACY_LLM_USAGE_TOKEN_SEMANTICS` environment variable is removed. In 1.5, it restored the earlier token counts that left out cache tokens. In logs, metrics, and CEL, input and total token counts now always include cache tokens. The token usage that agentgateway returns to clients follows the API that the client calls instead. For more information, see [Other behavior changes](#v16-behavior-changes).
- **Server-side defaults in the CRDs**: The CRD schemas no longer declare default values, such as `action: Allow` or `tracing.protocol: GRPC`. The controller applies the same defaults at runtime, so behavior does not change. However, `kubectl get -o yaml` now shows only the fields that you set. If your GitOps diffs or scripts expect the default values to appear in the stored resource, update them.

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
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3687 -->

- **Policy conflicts**: When two policies with the same specificity set the same field, the oldest policy by `metadata.creationTimestamp` now wins consistently. In 1.5, the winner was not predictable.
- **AI transformation fields**: The `spec.backend.ai.transformations` and `spec.backend.ai.finalTransformations` lists of an {{< reuse "agw-docs/snippets/policy.md" >}} now reject duplicate `field` values. A policy with duplicates fails validation when you next apply it.
- **LLM paths on a listener**: A model router that is attached to a `Gateway` or `ListenerSet` listener serves only the standard LLM paths, and each path must match exactly. To serve the paths under a prefix, attach the models to an `HTTPRoute`. For more information, see [Parent types]({{< link-hextra path="/documentation/llm/models/about/#parent-types" >}}).
- **Backend authentication errors**: When agentgateway cannot get credentials from a provider, such as an OAuth token endpoint, AWS STS, or Azure, the request now fails with `502` instead of `500`. Local failures, such as a static key that cannot be set, return `500` instead of `503`.
- **Backend request timeout**: The `spec.backend.http.requestTimeout` field of an {{< reuse "agw-docs/snippets/policy.md" >}} now also limits the time to read a buffered body. This limit applies to external authorization and CEL expressions that use `response.body`, for example. Streamed bodies are unaffected.
- **Access log level**: Request log records now use `error` when agentgateway records a request error, and `info` otherwise. In 1.5, all request records used `info`.
- **Guardrail results**: The `guardrails` CEL variable now has an entry for every guard that ran, including a new `allow` action. To find interventions only, filter on `action != "allow"`.
- **Failover eviction**: A backend or virtual model with more than one priority group now evicts a failing target by default. A health policy replaces this default. To keep failover, include `spec.backend.health.eviction` in the {{< reuse "agw-docs/snippets/policy.md" >}}. For concrete {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} targets, set `spec.policies.health.eviction`. For more information, see [Model failover]({{< link-hextra path="/documentation/llm/failover/" >}}).
- **Policy service timeouts**: Calls to external services default to a timeout of 2 seconds for gRPC external authorization and 10 seconds for rate limit and external processing services.
- **Streaming guardrails**: Agentgateway now rejects content if a provider guard fails while checking a streamed response or realtime connection. To keep the 1.5 behavior, set `failureMode: FailOpen` on the guard. For example, set it in `spec.backend.ai.promptGuard.response[].bedrockGuardrails` of an {{< reuse "agw-docs/snippets/policy.md" >}}. For more information, see [Provider failures]({{< link-hextra path="/documentation/llm/guardrails/overview/#provider-failures" >}}).
- **Token usage in responses**: The `usage` that agentgateway returns to clients now follows the conventions of the API that the client calls, whichever provider serves the request. Anthropic Messages responses leave cache tokens out of `input_tokens` and report them in `cache_read_input_tokens` and `cache_creation_input_tokens`. OpenAI Chat Completions and Responses include cache tokens in the input and total token counts. For example, a Chat Completions request to an Anthropic or Amazon Bedrock model that writes to the prompt cache now reports those cache tokens in `prompt_tokens`. If a client calculates usage or cost from these fields, review its counts after you upgrade.
- **Deployer ownership**: The controller no longer overwrites an existing resource of the same name that it does not own. It reports an error instead.

## 🌟 New features {#v16-new-features}

### LLM {#v16-llm}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3741 -->
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
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3731 -->

- **Meta provider**: Set `spec.provider: Meta` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} to use the Meta Model API preset. For the backend configuration, see [OpenAI-compatible providers]({{< link-hextra path="/integrations/llm/providers/openai-compatible/" >}}).
- **`AgentgatewayModel` on by default**: The `agentgatewayModels.enabled` Helm value now defaults to `true`. For more information, see [About models]({{< link-hextra path="/documentation/llm/models/about/" >}}).
- **Wildcard models in `/v1/models`**: For an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} with a wildcard `spec.match.model`, `/v1/models` lists matching model IDs from the catalog. For example, `openai/*` expands to IDs such as `openai/gpt-4o`. For more information, see [Verify model discovery]({{< link-hextra path="/documentation/llm/models/serve/#verify-model-discovery" >}}).
- **Skip broken virtual model targets**: A virtual model with one broken target skips that target instead of failing as a whole. For more information, see [Fail over when a model degrades]({{< link-hextra path="/documentation/llm/models/virtual/#fail-over-when-a-model-degrades" >}}).
- **Partially valid backends**: An {{< reuse "agw-docs/snippets/backend.md" >}} with one invalid inline policy is accepted with a `PartiallyValid` status instead of being dropped. For more information, see [Debug]({{< link-hextra path="/documentation/operations/debug/#check-the-gateway-route-and-policy-status" >}}).
- **Response idle timeout**: A response idle timeout ends a response if the backend stops sending body data for the configured time. It does not limit the duration of an active stream. Set `spec.traffic.timeouts.responseIdle` in an {{< reuse "agw-docs/snippets/policy.md" >}}. The [HTTP/1 idle timeout]({{< link-hextra path="/documentation/resiliency/timeouts/idle/" >}}) applies to unused client connections between requests. For more information, see [Timeouts]({{< link-hextra path="/documentation/resiliency/timeouts/about/#configuration-options" >}}).
- **Larger LLM buffer**: LLM requests can now buffer up to 32 MiB by default, up from 2 MiB. The larger buffer supports long-context prompts. To change the limit, set `spec.frontend.http.maxBufferSize` in an {{< reuse "agw-docs/snippets/policy.md" >}}. For more information, see [Buffer limits]({{< link-hextra path="/documentation/traffic-management/buffering/" >}}).
- **Per-page pricing**: To price OCR and document models that bill per processed page, set `rates.perPage` in the model's cost catalog entry. For more information, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}).
- **Bedrock Mantle routing**: The Bedrock provider chooses the Runtime or Mantle endpoint for each model. To set the preference, use `spec.bedrock.endpointPreference` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} or `spec.ai.provider.bedrock.endpointPreference` on an {{< reuse "agw-docs/snippets/backend.md" >}}. For more information, see [Bedrock Mantle]({{< link-hextra path="/integrations/llm/providers/bedrock/#bedrock-mantle" >}}).
- **More accurate Messages conversion**: Conversion between the Messages and OpenAI formats now carries citations, refusals, the `strict` setting of tool schemas, reasoning effort, and images in tool results. A context overflow error from the provider is translated so that Claude Code can compact and retry. For more information, see [Converted replies and errors]({{< link-hextra path="/integrations/llm/providers/custom/#converted-replies-and-errors" >}}).
- **Guardrails**: The `openAIModeration`, `bedrockGuardrails`, and `googleModelArmor` guards now support `failureMode`. Set this field on a guard in `spec.backend.ai.promptGuard` of an {{< reuse "agw-docs/snippets/policy.md" >}}. The built-in credit card pattern now checks the Luhn checksum. For more information, see [Provider failures]({{< link-hextra path="/documentation/llm/guardrails/overview/#provider-failures" >}}).

### Security {#v16-security}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3713 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3611 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3381 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3486 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3449 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3317 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3419 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3540 -->

- **JWT validation**: With several providers in the `spec.traffic.jwtAuthentication` field of an {{< reuse "agw-docs/snippets/policy.md" >}}, agentgateway tries each provider whose `issuer` and JWKS key ID match the token. A provider's `validation.requiredClaims` field sets the claims that a token must carry. Agentgateway also checks the `nbf` (not before) claim to reject tokens that are not yet valid. This check allows 60 seconds of leeway for clock skew. For more information, see [JWT required claims]({{< link-hextra path="/documentation/security/jwt/setup/#jwt-required-claims" >}}).
- **Backend authorization**: Kubernetes policies can now authorize requests after the destination backend is selected. Set `spec.backend.authorization` on an {{< reuse "agw-docs/snippets/policy.md" >}}, or configure authorization inline on an {{< reuse "agw-docs/snippets/backend.md" >}} for the whole backend or an individual AI provider. For more information, see [Authorize requests to a selected backend]({{< link-hextra path="/documentation/security/authorization/#backend-authorization" >}}).
- **Backend authentication**: In the `spec.backend.auth` field of an {{< reuse "agw-docs/snippets/policy.md" >}}, AWS `assumeRole` takes an `externalId`, and Azure authentication takes `scopes`. For more information, see [AWS]({{< link-hextra path="/documentation/security/backend-authn/providers/aws/#assume-an-iam-role" >}}) and [Azure]({{< link-hextra path="/documentation/security/backend-authn/providers/azure/#configure-token-scopes" >}}).
- **CA certificate key**: You can now read the CA bundle from a key other than `ca.crt`, such as one that trust-manager writes. Set `key` in a `caCertificateRefs` entry under `spec.backend.tls` of an {{< reuse "agw-docs/snippets/policy.md" >}}. For more information, see [Read the certificate from another key]({{< link-hextra path="/documentation/security/backendtls/#ca-key" >}}).
- **Network authorization by destination**: Expressions in the `spec.frontend.networkAuthorization` field of an {{< reuse "agw-docs/snippets/policy.md" >}} can match on `destination.address`, `destination.port`, and the TLS SNI hostname in `destination.hostname`. For more information, see [Restrict network access by TLS SNI]({{< link-hextra path="/documentation/security/authorization/#restrict-network-access-by-tls-sni" >}}).

### MCP {#v16-mcp}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3544 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3593 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3197 -->

- **List pagination**: List responses for tools, prompts, and resources carry a `nextCursor`. When an endpoint federates several targets, the client gets one combined cursor that tracks every target. For more information, see [List pagination]({{< link-hextra path="/documentation/mcp/spec-compatibility/#list-pagination" >}}).
- **Request size limit**: An MCP request body that is larger than the buffer limit returns `413`. For more information, see [Buffer limits]({{< link-hextra path="/documentation/traffic-management/buffering/#about-buffer-limits" >}}).
- **Method names in policies**: Agentgateway automatically sets `mcp.methodName` from the request's JSON-RPC method, such as `tools/call`. Route and backend policies can use this CEL variable for rate limits and authorization. For more information, see [MCP rate limits]({{< link-hextra path="/documentation/mcp/rate-limit/#how-tool-calls-map-to-http-requests" >}}).

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

- **Session affinity**: Session affinity sends related requests to the same endpoint. Set `spec.backend.sessionAffinity` in an {{< reuse "agw-docs/snippets/policy.md" >}}. Its CEL `source` expression provides the value to hash, such as a session header. For more information, see [Session affinity]({{< link-hextra path="/documentation/traffic-management/load-balancing/#session-affinity" >}}).
- **Per-key local rate limits**: Local rate limits can now give each user or API key a separate bucket. Set a CEL `key` in `spec.traffic.rateLimit.local` of an {{< reuse "agw-docs/snippets/policy.md" >}}. For more information, see [Claim-level rate limits]({{< link-hextra path="/documentation/security/rate-limit-http/#claim-level" >}}).
- **Stable ListenerSet ordering**: ListenerSets now have a stable order. They sort by creation time, oldest first, then by namespace and name. For more information, see [Listener precedence]({{< link-hextra path="/documentation/setup/listeners/overview/#listener-precedence" >}}).
- **Telemetry**: OTLP access logs use the `agentgateway.access` instrumentation scope. The request duration metric records failed requests with an `error_type` label.
- **Istio permissions**: Set the `istio.enabled=false` Helm value to drop the Istio permissions from the controller ClusterRole. For more information, see [Istio resource discovery]({{< link-hextra path="/documentation/install/advanced/#istio-discovery" >}}).
- **Gateway name in proxy metrics**: When `monitoring.enabled` is `true`, the Helm chart creates a PodMonitor. The PodMonitor now copies the `gateway.networking.k8s.io/gateway-name` pod label onto proxy metrics. This label lets the Grafana dashboard filter by Gateway. To change the copied labels, set the `monitoring.proxy.podMonitor.podTargetLabels` Helm value.

### OpenTelemetry field names {#v16-otel-attributes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->

You can now opt in to OpenTelemetry field names for stdout access logs. Set `preset: Otel` in `spec.frontend.accessLog` of an {{< reuse "agw-docs/snippets/policy.md" >}}. For more information, see [Use OpenTelemetry field names]({{< link-hextra path="/documentation/observability/access-logs/view/#preset" >}}).

## 🐛 Fixes {#v16-fixes}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3703 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3214 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3726 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3699 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3722 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3743 -->

**Traffic management**

- Connections with `maxConnectionDuration` close with up to 10% jitter, which reduces synchronized reconnects at the configured connection age.

**LLM**

- Vertex AI catalog lookups resolve Anthropic model aliases such as `claude-sonnet-4-5-20250929`, `anthropic/claude-sonnet-4-5@20250929`, and `publishers/anthropic/models/claude-sonnet-4-5@20250929`.
- A client query string, such as the `?beta=true` that Claude Code sends, is no longer forwarded when an LLM request is converted to another provider format. Before, strict providers such as Gemini rejected these requests with a `400` error.

**MCP**

- Access-log CEL expressions can now read dynamic metadata that ExtMCP request-phase guardrails return through `mcpGuardrails`, including on resumed stateful MCP sessions. For more information, see [Log MCP guardrail metadata]({{< link-hextra path="/documentation/observability/access-logs/view/#mcp-guardrails" >}}).
- OpenAPI MCP tools return `image/*` responses as MCP image content instead of UTF-8-decoded text.

**Security**

- The controller no longer fails on a JWT authentication policy that sets `jwks.remote.url` without a `backendRef` when the `AGW_BACKEND_REF_GRANT_MODE` environment variable is set to `route-and-policy`.
