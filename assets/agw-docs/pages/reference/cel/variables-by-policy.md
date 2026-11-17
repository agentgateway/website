Depending on the policy, different fields are accessible based on when in the request processing they are applied.

|Policy|Available Variables|
|------|-------------------|
|Transformation| `source`, `request`, `jwt`, `mcp`, `backend`, `extauthz`, `response`, `llm`, and `llmRequest` for parsed JSON LLM requests |
|Remote Rate Limit| `source`, `request`, `jwt`, `apiKey`, `mcp`, `backend`, `llm`, `llmRequest` [^1] |
|Local Rate Limit key (`requests`)| `source`, `request`, `jwt`, `apiKey`, `mcp`, `backend`, `llm`, `llmRequest` [^1] |
|Local Rate Limit key (`tokens`)| Same as a `requests` limit. [^1] |
|HTTP Authorization| `source`, `request`, `jwt`, `mcp`, `backend`, `llm`, `llmRequest` [^1] |
|External Authorization| `source`, `request`, `jwt`, `mcp`, `backend` |
|MCP Authorization| `source`, `request`, `jwt`, `mcp`, `backend` — `mcp.methodName` distinguishes methods such as `tools/list` and `tools/call`. For list methods, rules run once per listed item. `mcp.sessionId` and `mcp.tool.arguments` aren't set. |
|MCP guardrails (`expression`)| The same variables as MCP Authorization, plus `mcp.params` in request-phase processors and `mcp.result` in response-phase processors. For `tools/call`, `mcp.params.name` is the tool name without a target-name prefix. |
|MCP target condition| `source`, `request`, `jwt`, `mcp`, `backend` — `mcp.target.name` is the name of the target under evaluation. The condition runs before agentgateway contacts the target. |
|Logging| `source`, `request`, `jwt`, `apiKey`, `mcp`, `backend`, `extauthz`, `response`, `llm`, `guardrails`, `mcpGuardrails`, `upstreamCalls`|
|Tracing| `source`, `request`, `jwt`, `apiKey`, `mcp`, `backend`, `extauthz`, `response`, `llm`, `guardrails`, `mcpGuardrails`, `upstreamCalls`|
|Metrics| `source`, `request`, `jwt`, `apiKey`, `mcp`, `backend`, `extauthz`, `response`, `llm`, `guardrails`, `mcpGuardrails`, `upstreamCalls`|

[^1]: For LLM requests, `llm.requestModel` holds the model in the current request. `llm.originalModel` holds the model that the client sent before model rewrites. `llmRequest` holds the parsed JSON request body. A `requests` limit keyed by `llm.requestModel` counts requests separately for each model.

    Policies with `traffic.phase: PreRouting` run before LLM parsing and cannot read these fields.

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

Response payload fields, such as `mcp.tool.result` and `mcp.tool.error`, are available only in logging, tracing, and metrics. The same is true for `guardrails`, which holds the prompt guard results, and `mcpGuardrails`, which holds the metadata that MCP guardrail processors return.
