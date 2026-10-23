---
title: Variables and functions
weight: 3
description: How CEL variables are populated per policy phase, and where to find the full context reference and function list.
---

When using CEL expressions, a variety of variables and functions are made available.

## Variables

Variables are only available when they exist in the current context. Previously in version 0.11 or earlier, variables like `jwt` were always present but could be `null`. Now, to check if a JWT claim exists, use the expression `has(jwt.sub)`. This expression returns `false` if there is no JWT, rather than always returning `true`.

Additionally, fields are populated only if they are referenced in a CEL expression. This way, agentgateway avoids expensive buffering of request bodies if no CEL expression depends on the `body`.

Each policy execution consistently gets the current view of the request and response. For example, during logging, any manipulations from earlier policies (such as transformations or external processing) are observable in the CEL context.

For the full list of fields and types on every top-level object, see the [CEL reference]({{< link-hextra path="/reference/cel/cel-context" >}}) page. It is generated from the [agentgateway CEL schema](https://github.com/agentgateway/agentgateway/blob/main/schema/cel.md) and is the source of truth for nested fields (for example, `source.address` or `llm.inputTokens`).

When a policy can run against both directly addressed and Service backends, check `has(backend.endpoint)` before reading `backend.endpoint`. The field is populated only for directly addressed backends, such as static hostnames. Service backends leave `backend.endpoint` unset because workload endpoints are selected separately.

> [!NOTE]
> The `llm` object carries both normalized and provider-reported token counts. `llm.inputTokens` and `llm.totalTokens` include the tokens read from or written to the prompt cache, so they mean the same thing for every provider. `llm.providerInputTokens` and `llm.providerTotalTokens` report what the provider sent. For guidance on which one to read, see [Token usage fields]({{< link-hextra path="/documentation/llm/observability/#token-usage-fields" >}}).

### Agent sessions {#agent-sessions}

When agentgateway identifies an agent session, CEL expressions can read its ID as `request.agent.session`. Agentgateway detects the session before it applies any policy, so every request policy can read it.

For a logging example, see [Log the agent session]({{< link-hextra path="/documentation/observability/access-logs/view/#agent-session" >}}).

#### Session detection rules {#session-detection}

Agentgateway checks the following headers in order and uses the first valid value.

1. Any `x-<vendor>-session-id` header, such as `x-claude-code-session-id` from Claude Code. The `<vendor>` part can be any name.
2. The Codex headers `session-id`, `session_id`, `thread-id`, and `conversation_id`, in that order. Agentgateway reads these headers only when the `User-Agent` header starts with `codex` followed by `-`, `_`, `/`, or a space, such as `codex_cli_rs/0.50.0`.
3. The `x-session-id` header, such as from opencode.

A valid value has at least 8 characters and contains only letters, digits, hyphens (`-`), and underscores (`_`). Agentgateway skips an invalid value and checks the next header.

The following examples show which session each set of request headers produces.

| Request headers | `request.agent.session` |
| -- | -- |
| `x-claude-code-session-id: e96634a3-fa28-4083` and `x-session-id: opencode-1234` | `e96634a3-fa28-4083` |
| `x-session-id: opencode-1234` | `opencode-1234` |
| `User-Agent: codex_cli_rs/0.50.0` and `thread-id: 019a-thread-0001` | `019a-thread-0001` |
| `User-Agent: curl/8.7.1` and `session-id: 019a-thread-0001` | Not set, because the `User-Agent` is not Codex. |
| `x-session-id: short` | Not set, because the value has fewer than 8 characters. |

When no session is detected, `request.agent.session` is not set. To read the session with a fallback value, use the `default()` function, such as `default(request.agent.session, "none")`.

#### Override session detection {#session-override}

To override detection, set `config.standardAttributes.session` to a CEL expression that returns a string. Return `null` or an empty string to leave the request without an agent session. If the expression fails or returns another type, agentgateway uses the detected session instead. Agentgateway uses the string that the expression returns as is, without the length and character checks of the detection rules.

The following example reads the session from a custom `x-conversation` header. Requests without the header have no agent session, even if they send a header from the detection rules.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  standardAttributes:
    session: 'default(request.headers["x-conversation"], "")'
```

### Repeated request headers {#repeated-headers}

A client can send the same request header more than once, such as `curl -H 'x-a: 1' -H 'x-a: 2'`. In this case, `request.headers["x-a"]` returns a list of every value, such as `["1", "2"]`. When the header appears once, the same lookup returns a string, such as `"1"`.

Expressions that treat a header as a string do not work on a list. A comparison with a string returns `false`, and string functions such as `startsWith()` fail. For example, a client can skip the authorization rule `deny: 'request.headers["x-role"] == "guest"'` by sending the `x-role: guest` header twice.

The following table shows the results for a request that sends `x-a: 1` and `x-a: 2`.

| Expression | Result |
| -- | -- |
| `request.headers["x-a"]` | `["1", "2"]` |
| `request.headers["x-a"] == "1"` | `false` |
| `request.headers["x-a"].startsWith("1")` | Error |
| `request.headers.raw()["x-a"][0]` | `"1"` |
| `request.headers.join()["x-a"]` | `"1,2"` |

To get the same type of result whether or not a client repeats a header, use one of the following header views.

* **First value**: `request.headers.raw()["x-a"][0]`. The `raw()` view always returns a list, even for a header that appears once.
* **All values as one string**: `request.headers.join()["x-a"]` joins the values with commas.
* **All values as a list**: `request.headers.split()["x-a"]` also splits each value on commas, so `x-a: 1,2` and `x-a: 3` return `["1", "2", "3"]`.

For the full list of header views, see [Header Views](https://github.com/agentgateway/agentgateway/blob/main/schema/cel-functions.md#header-views) in the agentgateway CEL schema.

## Variables by policy type

Depending on the policy, different top-level variables are bound when CEL runs. A variable is only non-null when it is populated for the current request (for example, `has(jwt.sub)` or `has(apiKey.key)`). The same name can refer to different snapshots depending on pipeline stage: early policies evaluate against the live HTTP request, while logging, tracing, and metrics run after the exchange and can include `response`, `mcp`, and full telemetry fields. Note that when using streaming responses, the evaluation of response body attributes or LLM response information can be inconsistent.

| Policy | Available top-level variables |
|--------|------------------------------|
| Transformation (request) | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `llmRequest`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` — not `response`. [^1] |
| Transformation (response) | Same as request-path, plus `response` for response-side rules. [^2] |
| Remote rate limit | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `llmRequest`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` [^8] |
| Local rate limit key (`requests` rule) | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `llmRequest`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` — for example, the key `llm.requestModel` gives each model its own request count. [^7] [^8] |
| Local rate limit key (`tokens` rule) | Same as a `requests` rule. [^7] [^8] |
| HTTP Authorization | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `llmRequest`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` [^8] |
| Network authorization | `env`, `source` [^3] |
| External Authorization | `request`, `response`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` — some expressions run after the authorization service returns and can read `response`. [^4] |
| MCP Authorization | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` — `mcp.methodName` distinguishes methods such as `tools/list` and `tools/call`. For list methods, rules run once per listed item. `mcp.sessionId` and `mcp.tool.arguments` aren't set. |
| MCP guardrails (`kind: expression`) | The same variables as MCP Authorization, plus `mcp.params` in request-phase processors and `mcp.result` in response-phase processors. For `tools/call`, `mcp.params.name` is the tool name without a target-name prefix. |
| MCP target condition | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` — `mcp.target.name` is the name of the target under evaluation. The condition runs before agentgateway contacts the target. |
| External processing (ExtProc) | Request-phase rules: same as Transformation (request). Response-phase rules: same as Transformation (response). |
| LLM policy | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `llmRequest`, `source`, `backend`, `extauthz`, `extproc`, `metadata` — `llmRequest` is the raw JSON body during LLM request handling (not `mcp`). [^5] |
| Virtual model callout | Same as LLM policy. `transformation` and `cache.ttl` can also read `callout`, the callout response, with `callout.headers` and the decoded JSON `callout.body`. |
| Logging | `request`, `response`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` [^6] |
| Tracing | Same as Logging. |
| Metrics | Same as Logging. |

[^1]: Request-time transformation evaluation binds `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `backend`, `extauthz`, `extproc`, and `metadata` when earlier filters have populated them. For AI requests, `llm.requestModel` is available before provider overrides. `llmRequest` is available for the parsed JSON body. `mcp` is populated only for MCP JSON-RPC requests to an MCP backend.

[^2]: Response-side transformation sees the HTTP response object as well as the request snapshot fields.

[^3]: Network (L4) authorization uses `new_source` only: no HTTP `request` object.

[^4]: Some external authorization expressions run with only the client request; others run after the authorization service responds and can read the authorization HTTP response.

[^5]: LLM route transforms bind `llmRequest` to the parsed JSON body and restore the other fields from the stored request snapshot when available.

[^6]: For TCP logging, the executor is narrowed to `env`, `source`, and request timing fields (no full HTTP `request`/`response` objects).

[^7]: A key that reads a variable that is not bound where its rule runs cannot be evaluated, so the request counts against the rule's shared bucket instead. For more information, see [Per-key limits]({{< link-hextra path="/documentation/configuration/resiliency/rate-limits/#per-key" >}}).

[^8]: For LLM requests, request policies can read `llm.requestModel`, the model that the client requested, and `llmRequest`, the parsed JSON request body. Policies in the gateway phase run before agentgateway reads the LLM request, so they cannot read these fields. The gateway phase includes the `llm.policies` fields such as `authorization`, `apiKey`, and `jwtAuth` when the `llm` section listens on its own `port` instead of attaching to a gateway. The `localRateLimit` and `remoteRateLimit` fields of `llm.policies` can always read them.

### When `mcp` is available {#mcp-availability}

Policies can read request-time `mcp` fields only when all of the following are true:

* The policy runs in the route phase, after route selection. Policies with `phase: gateway` run before route selection and never see `mcp`.
* The selected backend is an MCP backend.
* The request is an MCP JSON-RPC `POST` request. The `mcp` variable isn't set for `/sse`, well-known OAuth metadata, or client registration requests.

At request time, `mcp.methodName` is always set, and `mcp.sessionId` is set when the client sends a session ID. The field for the method's target depends on the method.

| Method | Target field |
| -- | -- |
| `tools/call` | `mcp.tool`, including `mcp.tool.arguments` |
| `prompts/get` | `mcp.prompt` |
| Resource reads and subscriptions | `mcp.resource` |
| Task methods | `mcp.task` |
| List methods, such as `tools/list` | None. List methods have no target, so `mcp.tool` isn't set. |

MCP authorization rules differ in two ways. `mcp.sessionId` and `mcp.tool.arguments` aren't set. For list methods, the rules also run once for each listed item, and in each run the target field contains that item, such as `mcp.tool` for each tool in a `tools/list` response.

The `mcp.target.name` field identifies the MCP target for the current target-scoped operation, including [virtual MCP target conditions]({{< link-hextra path="/integrations/mcp/servers/virtual/#target-conditions" >}}) and upstream requests to an individual target. In a target condition, it names the target under evaluation. This differs from the method fields in the preceding table, such as `mcp.tool`, which describe the tool, prompt, resource, or task involved in a request.

In [CEL expression guardrails]({{< link-hextra path="/documentation/mcp/guardrails/processors/#expression" >}}), `mcp.params` holds the request's `params` object, and `mcp.result` holds the response's `result` object. Each processor sees changes from earlier processors.

Response payload fields, such as `mcp.tool.result` and `mcp.tool.error`, are available only in logging, tracing, and metrics.

## Functions {#functions-policy-all}

The following functions can be used in all policy types.

To define reusable functions from CEL expressions, see
[Custom functions]({{< link-hextra path="/reference/cel/custom-functions/" >}}).

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Standard Functions" %}}
