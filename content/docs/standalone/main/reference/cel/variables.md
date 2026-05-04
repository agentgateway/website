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

## Variables by policy type

Depending on the policy, different top-level variables are bound when CEL runs. A variable is only non-null when it is populated for the current request (for example, `has(jwt.sub)` or `has(apiKey.key)`). The same name can refer to different snapshots depending on pipeline stage: early policies evaluate against the live HTTP request, while logging, tracing, and metrics run after the exchange and can include `response`, `mcp`, and full telemetry fields.

| Policy | Available top-level variables |
|--------|------------------------------|
| Transformation (request) | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `backend`, `extauthz`, `extproc`, `metadata` — not `response`, `mcp`, or `llmRequest`. [^trans-req] |
| Transformation (response) | Same as request-path, plus `response` for response-side rules. [^trans-resp] |
| Remote rate limit | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `backend`, `extauthz`, `extproc`, `metadata` |
| HTTP Authorization | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `backend`, `extauthz`, `extproc`, `metadata` |
| Network authorization | `env`, `source` [^network] |
| External Authorization | `request`, `response`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `backend`, `extauthz`, `extproc`, `metadata` — some expressions run after the authorization service returns and can read `response`. [^extauthz] |
| MCP Authorization | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` |
| External processing (ExtProc) | Request-phase rules: same as Transformation (request). Response-phase rules: same as Transformation (response). |
| LLM policy | `request`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `llmRequest`, `source`, `backend`, `extauthz`, `extproc`, `metadata` — `llmRequest` is the raw JSON body during LLM request handling (not `mcp`). [^llm] |
| Logging | `request`, `response`, `env`, `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `mcp`, `backend`, `extauthz`, `extproc`, `metadata` [^tcp] |
| Tracing | Same as Logging. |
| Metrics | Same as Logging. |

[^trans-req]: Request-time evaluation binds `jwt`, `apiKey`, `basicAuth`, `llm`, `source`, `backend`, `extauthz`, `extproc`, and `metadata` when earlier filters have populated them; `mcp` only applies to MCP-specific policies.

[^trans-resp]: Response-side transformation sees the HTTP response object as well as the request snapshot fields.

[^network]: Network (L4) authorization uses `new_source` only: no HTTP `request` object.

[^extauthz]: Some external authorization expressions run with only the client request; others run after the authorization service responds and can read the authorization HTTP response.

[^llm]: LLM route transforms bind `llmRequest` to the parsed JSON body and restore the other fields from the stored request snapshot when available.

[^tcp]: For TCP logging, the executor is narrowed to `env`, `source`, and request timing fields (no full HTTP `request`/`response` objects).

## Functions {#functions-policy-all}

The following functions can be used in all policy types.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Standard Functions" %}}
