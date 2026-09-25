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
|Remote Rate Limit| `source`, `request`, `jwt`, `apiKey` |
|Local Rate Limit key (`requests`)| `source`, `request`, `jwt`, `apiKey` — the rule is checked before the LLM request is parsed, so a key cannot read `llm`. |
|Local Rate Limit key (`tokens`)| `source`, `request`, `jwt`, `apiKey`, `llm` — the rule is charged after the LLM request is parsed, so a key can read fields such as `llm.requestModel`. |
|HTTP Authorization| `source`, `request`, `jwt` |
|External Authorization| `source`, `request`, `jwt` |
|MCP Authorization| `source`, `request`, `jwt`, `mcp` |
|Logging| `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm`|
|Tracing| `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm`|
|Metrics| `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm`|

### MCP list result fields {#mcp-list-result-fields}

The `mcp` object changes by policy phase. During MCP authorization, `mcp` contains request-time identity fields, such as `mcp.tool.name`. During logging, tracing, and metrics, `mcp` can include terminal MCP server results. These fields are populated after a server returns a `list/*` response.

| Method | Result variable |
|--------|-----------------|
| `tools/list` | `mcp.toolsList` |
| `prompts/list` | `mcp.promptsList` |
| `resources/list` | `mcp.resourcesList` |
| `resources/templates/list` | `mcp.resourceTemplatesList` |

## Functions {#functions-policy-all}

The following functions can be used in all policy types.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Standard Functions" %}}
