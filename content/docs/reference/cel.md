---
title: CEL expressions
weight: 10
description: 
---

Agentgateway uses the [CEL](https://cel.dev/) expression language throughout the project to enable flexibility.
CEL allows writing simple expressions based on the request context that evaluate to some result.

## Example expressions

Review the following examples of expressions for different uses cases.

### Default function {#default-function}

You can use the `default` function to provide a fallback value if the expression cannot be resolved.

Request header fallback with example of an anonymous user:

```
default(request.headers["x-user-id"], "anonymous")
```

Nested object fallback with example of light theme:

```
default(json(request.body).user.preferences.theme, "light")
```

JWT claim fallback with example of default "user" role:

```
default(jwt.role, "user")
```

### Logs, traces, and observability {#logs}

```yaml
# Include logs where there was no response or there was an error
filter: |
   !has(response) || response.code > 299
fields:
  add:
    user.agent: 'request.headers["user-agent"]'
    # A static string. Note the expression is a string, and it returns a string, hence the double quotes.
    span.name: '"openai.chat"'
    gen_ai.usage.prompt_tokens: 'llm.input_tokens'
    # Parse the JSON request body, and conditionally log...
    # * If `type` is sum, val1+val2
    # * Else, val3
    # Example JSON request: `{"type":"sum","val1":2,"val2":3,"val4":"hello"}`
    json.field: |
      json(request.body).with(b,
         b.type == "sum" ?
           b.val1 + b.val2 :
           b.val3
      )

```

### Authorization {#authorization}

```yaml
mcpAuthorization:
  rules:
  # Allow anyone to call 'echo'
  - 'mcp.tool.name == "echo"'
  # Only the test-user can call 'add'
  - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
  # Any authenticated user with the claim `nested.key == value` can access 'printEnv'
  - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
```

### Rate limiting {#rate-limiting}

```yaml
remoteRateLimit:
   descriptors:
   # Rate limit requests based on a header, whether the user is authenticated, and a static value (used to match a specific rate limit rule on the rate limit server)
   - entries:
      - key: some-static-value
        value: '"something"'
      - key: organization
        value: 'request.headers["x-organization"]'
      - key: authenticated
        value: 'has(jwt.sub)'
```

## Context reference

When using CEL expressions, a variety of variables and functions are made available.

### Variables

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel.md" section="CEL context Schema" %}}

#### Variables by policy type

Depending on the policy, different fields are accessible based on when in the request processing they are applied.

|Policy|Available Variables|
|------|-------------------|
|Transformation| `source`, `request`, `jwt` |
|Remote Rate Limit| `source`, `request`, `jwt` |
|HTTP Authorization| `source`, `request`, `jwt` |
|MCP Authorization| `source`, `request`, `jwt`, `mcp` |
|Logging| `source`, `request`, `jwt`, `mcp`, `response`, `llm`|
|Tracing| `source`, `request`, `jwt`, `mcp`, `response`, `llm`|
|Metrics| `source`, `request`, `jwt`, `mcp`, `response`, `llm`|

Additionally, fields are populated only if they are referenced in a CEL expression.
This way, agentgateway avoids expensive buffering of request bodies if no CEL expression depends on the `body`.

### Functions {#functions-policy-all}

The following functions can be used in all policy types.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Standard Functions" %}}
