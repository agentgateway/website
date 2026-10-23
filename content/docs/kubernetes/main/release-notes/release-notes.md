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

Version 1.7 knows more about your models and your traffic than ever. Review the following highlights. Before you upgrade, also review the [breaking changes](#v17-breaking-changes). In particular, prompt guards inspect tool outputs by default, and dynamic forward proxy backends can no longer reach loopback or link-local addresses.

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

### CEL header lookups return every value of a repeated header {#v17-cel-headers}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3778 -->

A CEL lookup such as `request.headers["x-example"]` now returns a list when the header appears more than once in the request. Previously, the result depended on whether agentgateway could optimize the expression internally. The same lookup could return a single value in one expression and a list in another. Expressions that read headers that appear only once are unaffected.

**Actions to take**: Review CEL expressions that read request headers that a client can repeat, such as in authorization rules and transformations. Make sure that the expressions handle a list value. A comparison such as `request.headers["x-role"] == "guest"` returns `false` for a repeated header, so a client can skip a deny rule by sending the header twice. To read the first value, use `request.headers.raw()["x-role"][0]`. For more information, see [Repeated request headers]({{< link-hextra path="/reference/cel/variables/#repeated-headers" >}}).

### Dynamic forward proxy backends cannot connect to loopback or link-local addresses {#v17-dynamic-loopback}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3889 -->

An {{< reuse "agw-docs/snippets/backend.md" >}} with `spec.dynamicForwardProxy` now rejects destinations that resolve to loopback, link-local, or unspecified addresses, such as cloud metadata servers. Agentgateway checks the address after DNS resolution and returns `503` for a rejected request.

**Actions to take**: If a dynamic forward proxy backend must reach a service that is local to the proxy, set `config.backend.allowDynamicLoopback: true` in `spec.rawConfig` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. For more information, see [Allow loopback destinations]({{< link-hextra path="/documentation/traffic-management/dfp/#allow-dynamic-loopback" >}}) and [Raw config]({{< link-hextra path="/documentation/setup/customize/options/#raw-config" >}}).

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
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4054 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3873 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3897 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3793 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3957 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3992 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3953 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3831 -->

- **Proxy environment variables**: Callouts from the proxy, such as external authorization requests, guardrail requests, and AWS and Azure credential fetches, now use the `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, and `NO_PROXY` environment variables to configure a forward proxy that these requests must be routed through. In 1.6, only Google Cloud Platform (GCP) credential fetches used these variables. If you set these variables in `spec.env` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource for another purpose, callouts go through that forward proxy after you upgrade. To keep all callouts direct, set `NO_PROXY` to `*`. For more information, see [Callout proxy]({{< link-hextra path="/documentation/setup/customize/callout-proxy/" >}}).
- **Normalized service tier**: `llm.serviceTier` is now one of `standard`, `flex`, `priority`, or `reserved`, whatever the provider's own naming. A provider tier that agentgateway does not recognize leaves the value unset. Update CEL expressions and dashboards that compare against provider-specific values such as `default`. For more information, see [Service tiers]({{< link-hextra path="/documentation/llm/cost-controls/costs/#service-tiers" >}}).
- **`AgentgatewayModel` wildcard precedence**: An exact model name such as `openai/gpt-5.5` in an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} now wins over a wildcard such as `openai/*`, matching standalone. For more information, see [Model matching]({{< link-hextra path="/documentation/llm/models/about/#model-matching" >}}).
- **Invalid OAuth configuration**: Invalid `oauthTokenExchange` or `crossAppAccess` backend authentication no longer blocks the rest of your configuration from reaching the proxy. Only requests that use the invalid block fail, with HTTP `500` and the message `oauthTokenExchange configuration is invalid` or `crossAppAccess configuration is invalid`. The policy reports `Accepted: True` with the reason `PartiallyValid`. For more information, see [Debug your setup]({{< link-hextra path="/documentation/operations/debug/" >}}).
- **Bedrock `tool_choice`**: Client `tool_choice` settings now reach Bedrock Converse as `toolChoice`. Previously, they were dropped silently. Requests that force tool use on a model that does not support it, such as with extended thinking, now return an error from Bedrock.
- **Bedrock service tier**: The OpenAI `service_tier` values `priority`, `default`, and `flex` now reach Bedrock Converse as `serviceTier`. Previously, they were dropped silently, and Bedrock served the request at the standard tier. Requests for a tier that the model does not support now return a `400` error from Bedrock. For more information, see [Service tier]({{< link-hextra path="/integrations/llm/providers/bedrock/#service-tier" >}}).
- **Token rate limits for non-chat APIs**: Token-based LLM rate limits now count usage from Embeddings, Rerank, Decisions, and SystemOne requests.
- **LLM buffer size**: The 32 MiB default LLM request buffer now applies before request policies run instead of after.
- **Webhook guardrail responses**: A webhook `pass` response that contains any field other than `reason` is now an error. So is a `mask` response whose messages contain extra fields, which previously passed the content unmasked. The error follows the guard's `failureMode`. For more information, see [Webhook response actions]({{< link-hextra path="/documentation/llm/guardrails/webhook/guardrails/#webhook-response-actions" >}}).
- **Google Model Armor errors**: A non-success response from Model Armor is now a guard failure and follows the guard's `failureMode`.
- **Backend mirrors**: Request mirror filters in the `backendRefs` of an `HTTPRoute` now run after backend policies, so requests that backend authorization rejects are no longer mirrored. Mirror filters on a route rule still run before backend policies.
- **MCP session errors**: Stateful MCP requests with a session ID that the proxy cannot decode, such as after the session key changes, now return `404` instead of `400`. Clients then start a new session.
- **MCP capabilities**: Multiplexed MCP sessions now advertise `listChanged` and `subscribe` only when at least one upstream target offers them. In 1.6, agentgateway always advertised them. Stateless sessions advertise none. For more information, see [Capabilities and change notifications]({{< link-hextra path="/documentation/mcp/virtual/#capabilities" >}}).
- **gRPC health**: Errors that agentgateway itself returns to gRPC clients now record their `grpc-status`. Only server-side gRPC errors, such as `UNAVAILABLE` or `INTERNAL`, mark a backend unhealthy. A client-side gRPC status from an LLM provider no longer evicts the target from a failover group. This change matches how agentgateway treats `5xx` and `4xx` responses for HTTP.
- **gRPC policy calls**: When a gRPC policy call, such as to an external processing server, fails before it reaches the service, agentgateway now reports the mapped gRPC status instead of `UNKNOWN`. For example, DNS errors, refused connections, and timeouts report `UNAVAILABLE`.
- **Anthropic version header**: Agentgateway forwards the client's `anthropic-version` header instead of replacing it. When the client does not send the header, agentgateway still sets the default value `2023-06-01`.
- **Controller reconciliation metrics**: The controller no longer reports `agentgateway_controller_reconcile_duration_seconds` or `agentgateway_controller_reconciliations_running`. `agentgateway_controller_reconciliations_total` reports only the controller and result, without the `name` and `namespace` labels. Update dashboards and alerts that use these metrics. For more information, see [Control plane metrics reference]({{< link-hextra path="/documentation/observability/metrics/control-plane/#control-plane-metrics-reference" >}}).
- **Configuration warning Events**: Configuration warnings in the proxy's xDS responses now publish Kubernetes Events with the reason `AgentGatewayConfigWarning` and increment `agentgateway_xds_warnings_total`. Warnings do not count the response as rejected. In 1.6, these warnings were reported as rejections, with the `AgentGatewayNackError` reason and the `agentgateway_xds_rejects_total` counter. If your alerts watch for rejections, also alert on warnings. For more information, see [View configuration warnings]({{< link-hextra path="/documentation/observability/metrics/nacks/#config-warnings" >}}).
- **GenAI operation name**: The `gen_ai.operation.name` attribute in access logs and traces now reflects the request type, such as `generate_content`, `embeddings`, `rerank`, `realtime`, `decisions`, or `count_tokens`. Requests on a route with the `Detect` route type record `unknown`. In 1.6, every request except Embeddings requests recorded `chat`. Update queries and dashboards that filter on `chat`. For more information, see [Operation names]({{< link-hextra path="/documentation/observability/traces/attribute-reference/#operation-names" >}}).

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
- **Callouts through a proxy**: You can now send the requests that the agentgateway proxy makes on its own behalf, such as external authorization requests, guardrail requests, and cloud provider credential fetches, through a forward proxy. For more information, see [Callout proxy]({{< link-hextra path="/documentation/setup/customize/callout-proxy/" >}}).
- **Optional chart-created RBAC**: Set `rbac.create` to `false` in the controller Helm chart to skip the ClusterRoles, Role, ClusterRoleBindings, and RoleBindings that the chart creates, for clusters that manage role-based access control (RBAC) outside of Helm. For more information, see [Chart-created RBAC resources]({{< link-hextra path="/documentation/install/advanced/#rbac-create" >}}).

### Observability {#v17-observability}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3850 -->

- **Agent sessions**: Agentgateway detects the agent session that a request belongs to from well-known agent headers, such as `x-claude-code-session-id`. CEL expressions can read the session ID as `request.agent.session`. For more information, see [Agent sessions]({{< link-hextra path="/reference/cel/variables/#agent-sessions" >}}).

### MCP {#v17-mcp}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3824 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4060 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4062 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3976 -->

- **Conditional virtual MCP targets**: Set `spec.mcp.targets[].condition` on an {{< reuse "agw-docs/snippets/backend.md" >}} to a CEL expression to select which targets take part in a request before agentgateway initializes or contacts them. A backend whose only target is a `static` target cannot set a condition. Conditions are checked on each request, and an invalid CEL condition reports `PartiallyValid` in the backend status. For more information, see [Include targets conditionally]({{< link-hextra path="/documentation/mcp/virtual/#target-conditions" >}}).
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
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4049 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/4053 -->

- **Shared HTTPS and TLS ports**: HTTPS and TLS passthrough listeners on the same Gateway can share a port. Agentgateway selects the listener by SNI hostname. For more information, see [Share the HTTPS port with a TLS passthrough listener]({{< link-hextra path="/documentation/setup/listeners/https/#tls-passthrough-shared-port" >}}).
- **Native histogram scraping**: In the controller Helm chart, the controller ServiceMonitor (`monitoring.serviceMonitor`) and the proxy PodMonitor (`monitoring.proxy.podMonitor`) support native histogram scraping, relabelings, and metric relabelings. Native histogram scraping is off by default and requires Prometheus v3.8.0 or later and Prometheus Operator v0.88.0 or later. For more information, see [Scrape native histograms]({{< link-hextra path="/documentation/observability/metrics/overview/#native-histograms" >}}).
- **Graceful HTTP/1 drain**: When a proxy drains or a connection reaches its maximum connection duration, HTTP/1 clients receive `Connection: close` on the next response, so that they close the connection cleanly.
- **Faster controller**: The controller does less work when unrelated resources change. Status and xDS output are more stable, which reduces unnecessary writes and pushes.
- **`agctl bug-report`**: Collect cluster resources, logs, and metrics into a single archive to share for troubleshooting. For more information, see [Collect a bug report]({{< link-hextra path="/documentation/operations/debug/#bug-report" >}}).
- **Client Setup in the UI**: The UI can generate LLM client settings for the models that your Gateway serves, including a recipe for Continue. For more information, see [Generate LLM client settings]({{< link-hextra path="/documentation/observability/ui/#client-setup" >}}).
- **Controller admin bind address**: Set the `AGW_UNSAFE_ADMIN_BIND_ADDRESS` environment variable on the controller, such as through `controller.extraEnv`, so that the controller admin server listens on an address other than `localhost` for debugging. The admin server has no authentication, so do not use this setting in production. For more information, see [Expose the admin server on the pod network]({{< link-hextra path="/documentation/operations/debug/#admin-bind-address" >}}).
- **Controller init containers**: Add init containers, including native sidecar containers, to the controller pod with `controller.extraInitContainers` in the controller Helm chart. For more information, see [Init containers]({{< link-hextra path="/documentation/install/advanced/#extra-init-containers" >}}).

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
