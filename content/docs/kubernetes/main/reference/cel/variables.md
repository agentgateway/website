---
title: Variables and functions
weight: 3
description: How CEL variables are populated per policy phase, and where to find the full context reference and function list.
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

Use `llm.responseId` for the provider response ID and `llm.finishReasons` for the finish reasons, one per returned choice. The fields become available only after agentgateway parses provider response metadata, such as in logging, tracing, and metrics. On streamed LLM responses, response transformations can still run before response-derived LLM fields become available. The OpenAI Responses API does not send a finish reason. For that API, `completed` becomes `stop`, `failed` becomes `error`, and `incomplete` uses `incomplete_details.reason` when present.

{{< reuse "agw-docs/pages/reference/cel/agent-sessions.md" >}}

{{< reuse "agw-docs/pages/reference/cel/repeated-headers.md" >}}

## Variables by policy type

{{< reuse "agw-docs/pages/reference/cel/variables-by-policy.md" >}}

## Functions {#functions-policy-all}

The following functions can be used in all policy types.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Standard Functions" %}}
