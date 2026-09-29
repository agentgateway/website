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

> [!NOTE]
> The `llm` object carries both normalized and provider-reported token counts. `llm.inputTokens` and `llm.totalTokens` include the tokens read from or written to the prompt cache, so they mean the same thing for every provider. `llm.providerInputTokens` and `llm.providerTotalTokens` report what the provider sent. For guidance on which one to read, see [Token usage fields]({{< link-hextra path="/documentation/llm/observability/#token-usage-fields" >}}).

## Variables by policy type

Depending on the policy, different fields are accessible based on when in the request processing they are applied.

|Policy|Available Variables|
|------|-------------------|
|Transformation| `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm` |
|Remote Rate Limit| `source`, `request`, `jwt`, `apiKey`, `mcp` |
|Local Rate Limit key (`requests`)| `source`, `request`, `jwt`, `apiKey`, `mcp` — the rule is checked before the LLM request is parsed, so a key cannot read `llm`. |
|Local Rate Limit key (`tokens`)| `source`, `request`, `jwt`, `apiKey`, `mcp`, `llm` — the rule is charged after the LLM request is parsed, so a key can read fields such as `llm.requestModel`. |
|HTTP Authorization| `source`, `request`, `jwt`, `mcp` |
|External Authorization| `source`, `request`, `jwt`, `mcp` |
|MCP Authorization| `source`, `request`, `jwt`, `mcp` — `mcp.methodName` distinguishes methods such as `tools/list` and `tools/call`. For list methods, rules run once per listed item. `mcp.sessionId` and `mcp.tool.arguments` aren't set. |
|Logging| `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm`|
|Tracing| `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm`|
|Metrics| `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm`|

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

Response payload fields, such as `mcp.tool.result` and `mcp.tool.error`, are available only in logging, tracing, and metrics.

## Functions {#functions-policy-all}

The following functions can be used in all policy types.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Standard Functions" %}}
