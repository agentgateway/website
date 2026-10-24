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

CEL expressions read the detected session ID as `request.agent.session`. Detection runs before all policies, making the ID available to every request policy.

For a logging example, see [Log the agent session]({{< link-hextra path="/documentation/observability/access-logs/view/#agent-session" >}}).

#### Session detection rules {#session-detection}

Agentgateway checks the following well-known headers in order and uses the first valid value.

1. Any `x-<vendor>-session-id` header, such as Claude Code's `x-claude-code-session-id`. The `<vendor>` part can be any name.
2. The Codex headers `session-id`, `session_id`, `thread-id`, and `conversation_id`, in that order.

   These headers require a `User-Agent` starting with `codex` followed by `-`, `_`, `/`, or a space. For example: `codex_cli_rs/0.50.0`.

3. The `x-session-id` header, such as from opencode.

Values must have at least 8 characters. Only letters, digits, hyphens (`-`), and underscores (`_`) are allowed. Agentgateway skips invalid values and checks the next header.

Examples of detected sessions:

| Request headers | `request.agent.session` |
| -- | -- |
| `x-claude-code-session-id: e96634a3-fa28-4083` and `x-session-id: opencode-1234` | `e96634a3-fa28-4083` |
| `x-session-id: opencode-1234` | `opencode-1234` |
| `User-Agent: codex_cli_rs/0.50.0` and `thread-id: 019a-thread-0001` | `019a-thread-0001` |
| `User-Agent: curl/8.7.1` and `session-id: 019a-thread-0001` | Not set, because the `User-Agent` is not Codex. |
| `x-session-id: short` | Not set, because the value has fewer than 8 characters. |

If no session is detected, `request.agent.session` is unset. Use `default(request.agent.session, "none")` to provide a fallback value.

#### Override session detection {#session-override}

If the default session detection does not fit your clients, you can override it. Set the `config.standardAttributes.session` field to a CEL expression that returns the session ID for your clients. Agentgateway evaluates the expression for each request and uses the result as follows:

| Expression result | Agent session |
| -- | -- |
| A non-empty string | The string, as is. The length and character checks from the detection rules don't apply. |
| `null` or an empty string | None. The request has no agent session, even if it has a recognized session header. |
| Any other type, or an error | Agentgateway ignores the expression and uses the default detection from [Session detection rules](#session-detection). The result is the ID from the request headers, or no session if none match. |

An expression that reads a missing header fails with an error. To leave requests without that header unset instead of falling back to default session detection, wrap the session lookup in a `default()` function, as shown in the following example. Requests without an `x-conversation` header have no agent session, even if they have another recognized session header.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  standardAttributes:
    session: 'default(request.headers["x-conversation"], "")'
```

### Repeated request headers {#repeated-headers}

A client can send the same header more than once. In CEL, `request.headers["x-a"]` then returns a list of values, not a string. When the header is sent once, it returns a string. Because the type changes depending on what the client sends, an expression that works for one value can behave differently for repeated values:

* Comparing a list to a string with `==` returns `false`.
* String functions such as `startsWith()` fail with an error.

This behavior can open a security hole. Take a rule that denies requests that include `x-role: guest`, such as the authorization rule `deny: 'request.headers["x-role"] == "guest"'`. If a client sends `x-role: guest` twice, the lookup returns `["guest", "guest"]`. The comparison is false, the deny rule doesn't match, and the request is allowed.

To get a consistent type, read the header through a header view. The following table shows the result of each expression for a request made with `curl -H 'x-a: 1' -H 'x-a: 2'`:

| Expression | Result | Use it to |
| -- | -- | -- |
| `request.headers["x-a"]` | `["1", "2"]` | Not recommended. The type depends on how many times the header is sent. |
| `request.headers["x-a"] == "1"` | `false` | Not recommended. The comparison is false for repeated headers. |
| `request.headers["x-a"].startsWith("1")` | Error | Not recommended. String functions fail for repeated headers. |
| `request.headers.raw()["x-a"][0]` | `"1"` | Get the first value. |
| `request.headers.join()["x-a"]` | `"1,2"` | Get all values as one string. |
| `request.headers.split()["x-a"]` | `["1", "2"]` | Get all values as a list, with comma-separated values split too. |

The `raw()` view always returns a list, even if the header is sent once, so `[0]` works for single and repeated headers. The `split()` view also splits each value on commas, so `x-a: 1,2` and `x-a: 3` together return `["1", "2", "3"]`. For the full list of header views, see [Header Views](https://github.com/agentgateway/agentgateway/blob/main/schema/cel-functions.md#header-views) in the agentgateway CEL schema.

## Variables by policy type

Depending on the policy, different top-level variables are bound when CEL runs. A variable is only non-null when it is populated for the current request (for example, `has(jwt.sub)` or `has(apiKey.key)`). The same name can refer to different snapshots depending on pipeline stage: early policies evaluate against the live HTTP request, while logging, tracing, and metrics run after the exchange and can include `response`, `mcp`, and full telemetry fields. Note that when using streaming responses, the evaluation of response body attributes or LLM response information can be inconsistent.

| Policy | Available top-level variables |
|--------|------------------------------|
| Transformation (request) | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `llmRequest`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` — not `response`. [^1] |
| Transformation (response) | Same as request-path, plus `response` for response-side rules. [^2] |
| Remote rate limit | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `llmRequest`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` [^8] |
| Local rate limit key (`requests` rule) | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `llmRequest`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` [^7] [^8] |
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

[^8]: For LLM requests, `llm.requestModel` holds the model requested by the client. `llmRequest` holds the parsed JSON request body. A `requests` rule keyed by `llm.requestModel` counts requests separately for each model.

    Policies in the gateway phase run before LLM parsing and cannot read these fields. When `llm` listens on its own `port`, this includes `llm.policies.authorization`, `llm.policies.apiKey`, and `llm.policies.jwtAuth`.

    The `llm.policies.localRateLimit` and `llm.policies.remoteRateLimit` fields can always read the LLM fields.

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
