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

For the full list of fields available on each top-level object (`request`, `response`, `jwt`, `mcp`, `llm`, `source`, `extauthz`), see the [CEL Expression Context]({{< link-hextra path="/reference/cel/cel-context" >}}) reference, which is generated from the agentgateway schema.

## Variables by policy type

Depending on the policy, different fields are accessible based on when in the request processing they are applied.

| Policy | Available variables |
|--------|---------------------|
| Transformation | `source`, `request`, `jwt`, `extauthz` |
| Remote Rate Limit | `source`, `request`, `jwt` |
| HTTP Authorization | `source`, `request`, `jwt` |
| External Authorization | `source`, `request`, `jwt` |
| MCP Authorization | `source`, `request`, `jwt`, `mcp` |
| Logging | `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm` |
| Tracing | `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm` |
| Metrics | `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm` |

## Functions {#functions-policy-all}

The following functions can be used in all policy types.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Standard Functions" %}}
