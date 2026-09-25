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

> [!NOTE]
> The `llm` object carries both normalized and provider-reported token counts. `llm.inputTokens` and `llm.totalTokens` include the tokens read from or written to the prompt cache, so they mean the same thing for every provider. `llm.providerInputTokens` and `llm.providerTotalTokens` report what the provider sent. For guidance on which one to read, see [Token usage fields]({{< link-hextra path="/documentation/llm/observability/#token-usage-fields" >}}).

## Variables by policy type

Depending on the policy, different top-level variables are bound when CEL runs. A variable is only non-null when it is populated for the current request (for example, `has(jwt.sub)` or `has(apiKey.key)`). The same name can refer to different snapshots depending on pipeline stage: early policies evaluate against the live HTTP request, while logging, tracing, and metrics run after the exchange and can include `response`, `mcp`, and full telemetry fields. Note that when using streaming responses, the evaluation of response body attributes or LLM response information can be inconsistent.

| Policy | Available top-level variables |
|--------|------------------------------|
| Transformation (request) | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` — not `response` or `llmRequest`. [^1] |
| Transformation (response) | Same as request-path, plus `response` for response-side rules. [^2] |
| Remote rate limit | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` |
| Local rate limit key (`requests` rule) | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` — not `llm`, because the rule is checked before the LLM request is parsed. [^7] |
| Local rate limit key (`tokens` rule) | Same as a `requests` rule, plus `llm` for fields such as `llm.requestModel`, because the rule is charged after the LLM request is parsed. [^7] |
| HTTP Authorization | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` |
| Network authorization | `env`, `source` [^3] |
| External Authorization | `request`, `response`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` — some expressions run after the authorization service returns and can read `response`. [^4] |
| MCP Authorization | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` — `mcp.methodName` distinguishes methods such as `tools/list` and `tools/call`. For list methods, rules run once per listed item. `mcp.sessionId` and `mcp.tool.arguments` aren't set. |
| External processing (ExtProc) | Request-phase rules: same as Transformation (request). Response-phase rules: same as Transformation (response). |
| LLM policy | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `llmRequest`, `source`, `backend`, `extauthz`, `extproc`, `metadata` — `llmRequest` is the raw JSON body during LLM request handling (not `mcp`). [^5] |
| Logging | `request`, `response`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` [^6] |
| Tracing | Same as Logging. |
| Metrics | Same as Logging. |

[^1]: Request-time transformation evaluation binds `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `backend`, `extauthz`, `extproc`, and `metadata` when earlier filters have populated them. `mcp` is populated only for MCP JSON-RPC requests to an MCP backend.

[^2]: Response-side transformation sees the HTTP response object as well as the request snapshot fields.

[^3]: Network (L4) authorization uses `new_source` only: no HTTP `request` object.

[^4]: Some external authorization expressions run with only the client request; others run after the authorization service responds and can read the authorization HTTP response.

[^5]: LLM route transforms bind `llmRequest` to the parsed JSON body and restore the other fields from the stored request snapshot when available.

[^6]: For TCP logging, the executor is narrowed to `env`, `source`, and request timing fields (no full HTTP `request`/`response` objects).

[^7]: A key that reads a variable that is not bound where its rule runs cannot be evaluated, so the request counts against the rule's shared bucket instead. For more information, see [Per-key limits]({{< link-hextra path="/documentation/configuration/resiliency/rate-limits/#per-key" >}}).

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

Response payload fields, such as `mcp.tool.result` and `mcp.tool.error`, are available only in logging, tracing, and metrics.

## Functions {#functions-policy-all}

The following functions can be used in all policy types.

To define reusable functions from CEL expressions, see
[Custom functions]({{< link-hextra path="/reference/cel/custom-functions/" >}}).

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Standard Functions" %}}
