---
title: Variables and functions
weight: 3
description: How CEL variables are populated per policy phase, and where to find the full context reference and function list.
test: skip
---

When using CEL expressions, a variety of variables and functions are made available.

## Variables

Variables are only available when they exist in the current context. Previously in version 0.11 or earlier, variables like `jwt` were always present but could be `null`. Now, to check if a JWT claim exists, use the expression `has(jwt.sub)`. This expression returns `false` if there is no JWT, rather than always returning `true`.

Additionally, fields are populated only if they are referenced in a CEL expression.
This way, agentgateway avoids expensive buffering of request bodies if no CEL expression depends on the `body`.

Each policy execution consistently gets the current view of the request and response. For example, during logging, any manipulations from earlier policies (such as transformations or external processing) are observable in the CEL context.

For the full list of fields and types on every top-level object, see the [Interactive CEL reference]({{< link-hextra path="/reference/cel/cel-context-interactive" >}}) page.

When a policy can run against both directly addressed and Service backends, check `has(backend.endpoint)` before reading `backend.endpoint`. The field is populated only for directly addressed backends, such as static hostnames. Service backends leave `backend.endpoint` unset because workload endpoints are selected separately.

> [!NOTE]
> The `llm` object carries both normalized and provider-reported token counts. `llm.inputTokens` and `llm.totalTokens` include the tokens read from or written to the prompt cache, so they mean the same thing for every provider. `llm.providerInputTokens` and `llm.providerTotalTokens` report what the provider sent. For guidance on which one to read, see [Token usage fields]({{< link-hextra path="/documentation/llm/observability/#token-usage-fields" >}}).

### Agent sessions {#agent-sessions}

When agentgateway identifies an agent session, CEL expressions can read its ID as `request.agent.session`. Agentgateway detects the session before it applies any policy, so every request policy can read it.

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

### Repeated request headers {#repeated-headers}

A client can send the same request header more than once, such as `curl -H 'x-a: 1' -H 'x-a: 2'`. In this case, `request.headers["x-a"]` returns a list of every value, such as `["1", "2"]`. When the header appears once, the same lookup returns a string, such as `"1"`.

Expressions that treat a header as a string do not work on a list. A comparison with a string returns `false`, and string functions such as `startsWith()` fail. For example, a client can skip a `Deny` authorization rule with the expression `request.headers["x-role"] == "guest"` by sending the `x-role: guest` header twice.

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

Depending on the policy, different fields are accessible based on when in the request processing they are applied.

|Policy|Available Variables|
|------|-------------------|
|Transformation| `source`, `request`, `jwt`, `mcp`, `backend`, `extauthz`, `response`, `llm`, and `llmRequest` for parsed JSON LLM requests |
|Remote Rate Limit| `source`, `request`, `jwt`, `apiKey`, `mcp`, `backend`, `llm`, `llmRequest` [^1] |
|Local Rate Limit key (`requests`)| `source`, `request`, `jwt`, `apiKey`, `mcp`, `backend`, `llm`, `llmRequest` — for example, the key `llm.requestModel` gives each model its own request count. [^1] |
|Local Rate Limit key (`tokens`)| Same as a `requests` limit. [^1] |
|HTTP Authorization| `source`, `request`, `jwt`, `mcp`, `backend`, `llm`, `llmRequest` [^1] |
|External Authorization| `source`, `request`, `jwt`, `mcp`, `backend` |
|MCP Authorization| `source`, `request`, `jwt`, `mcp`, `backend` — `mcp.methodName` distinguishes methods such as `tools/list` and `tools/call`. For list methods, rules run once per listed item. `mcp.sessionId` and `mcp.tool.arguments` aren't set. |
|MCP guardrails (`expression`)| The same variables as MCP Authorization, plus `mcp.params` in request-phase processors and `mcp.result` in response-phase processors. For `tools/call`, `mcp.params.name` is the tool name without a target-name prefix. |
|MCP target condition| `source`, `request`, `jwt`, `mcp`, `backend` — `mcp.target.name` is the name of the target under evaluation. The condition runs before agentgateway contacts the target. |
|Logging| `source`, `request`, `jwt`, `mcp`, `backend`, `extauthz`, `response`, `llm`|
|Tracing| `source`, `request`, `jwt`, `mcp`, `backend`, `extauthz`, `response`, `llm`|
|Metrics| `source`, `request`, `jwt`, `mcp`, `backend`, `extauthz`, `response`, `llm`|

[^1]: For LLM requests, request policies can read `llm.requestModel`, the model that the client requested, and `llmRequest`, the parsed JSON request body. Policies with `traffic.phase: PreRouting` run before agentgateway reads the LLM request, so they cannot read these fields.

### When `mcp` is available {#mcp-availability}

Request policies, such as transformation, rate limit, and authorization policies, can read `mcp` only when all of the following are true:

* The policy runs after route selection. Policies with `traffic.phase: PreRouting` run before route selection and never see `mcp`.
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

The `mcp.target.name` field identifies the MCP target for the current target-scoped operation, including [virtual MCP target conditions]({{< link-hextra path="/documentation/mcp/virtual/#target-conditions" >}}). In a target condition, it names the target under evaluation. This differs from the method fields in the preceding table, such as `mcp.tool`, which describe the tool, prompt, resource, or task involved in a request.

In [CEL expression guardrails]({{< link-hextra path="/documentation/mcp/guardrails/processors/#expression" >}}), `mcp.params` holds the request's `params` object, and `mcp.result` holds the response's `result` object. Each processor sees changes from earlier processors.

Response payload fields, such as `mcp.tool.result` and `mcp.tool.error`, are available only in logging, tracing, and metrics.

## Functions {#functions-policy-all}

The following functions can be used in all policy types.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Standard Functions" %}}
