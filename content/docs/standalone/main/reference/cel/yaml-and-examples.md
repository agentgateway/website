---
title: CEL in YAML and example expressions
weight: 2
description: How to embed CEL expressions in YAML configuration, plus worked examples for common use cases.
---

## CEL in YAML

When writing CEL expressions in agentgateway, typically they are expressed as YAML string values, which can cause confusion. Any string literals within the expression need to be escaped with additional quotes.

These examples all represent the same CEL expression, a string literal `"hello"`.

```yaml
doubleQuote: "'hello'"
doubleQuoteEscaped: "\"hello\""
singleQuote: '"hello"'
blockSingle: |
  'hello'
blockDouble: |
  "hello"
```

These examples all represent the same CEL expression, a variable `request`:

```yaml
doubleQuote: "request"
singleQuote: 'request'
block: |
  request
```

The `block` style is often the most readable for complex expressions, and also allows for multi-line expressions without needing to escape quotes.

## Example expressions

Review the following examples of expressions for different use cases.

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

{{< gloss "JWT (JSON Web Token)" >}}JWT{{< /gloss >}} claim fallback with example of default "user" role:

```
default(jwt.role, "user")
```

### Logs, traces, and observability {#logs}

```yaml
# Include logs where there was no response or there was an error
filter: |
   !has(response.code) || response.code > 299
fields:
  add:
    user.agent: 'request.headers["user-agent"]'
    # A static string. Note the expression is a string, and it returns a string, hence the double quotes.
    span.name: '"openai.chat"'
    # Cache-inclusive and consistent across providers. For the provider's own
    # count, use 'llm.providerInputTokens' instead.
    gen_ai.usage.prompt_tokens: 'llm.inputTokens'
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

#### Log outbound calls from access logs {#log-outbound-calls-from-access-logs}

Access log expressions can use `upstreamCalls` to inspect the outbound HTTP calls made for a request, such as MCP target calls and policy callouts. The `upstreamCalls` list is filled in only when an access log expression references `upstreamCalls`. Calls to `stdio` MCP targets are not in the list, because a `stdio` target does not use HTTP.

The following example adds two fields to the access log:

- `mcp_token_audiences`: The `aud` claim of the bearer token that each MCP target receives in the `authorization` header, after backend authentication or token exchange.
- `upstream_call_statuses`: The kind, subtype, target, and HTTP status code of each outbound call.

```yaml
frontendPolicies:
  accessLog:
    add:
      mcp_token_audiences: 'upstreamCalls.filter(c, c.subtype == "Mcp" && has(c.request.headers.authorization) && c.request.headers.authorization.startsWith("Bearer ")).map(c, unvalidatedJwtPayload(c.request.headers.authorization.split(" ")[1]).aud)'
      upstream_call_statuses: 'upstreamCalls.map(c, {"kind": c.kind, "subtype": c.subtype, "target": c.target, "status": c.response.code})'
```

Each entry in `upstreamCalls` has the following fields that the example uses. For every field, see the [CEL reference]({{< link-hextra path="/reference/cel/cel-context" >}}).

| Field | Description |
|-------|-------------|
| `kind` | `Primary` for the backend request, or `Policy` for a policy callout. |
| `subtype` | The type of call, such as `Mcp`, `Llm`, `ExtAuthz`, or `Http`. |
| `target` | For an MCP call, the name of the MCP target. For other calls, the connection address in `host:port` form. |
| `request.headers` | The headers sent to the backend, after backend authentication. The top-level `request.headers` variable still has the headers from the client. |
| `response.code` | The HTTP status code. Empty when the call got no response. To find out why a call failed, read the `error` field. |

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

MCP authorization rules control both which tools, prompts, and resources a client can see and which ones it can use. When a client sends a list request, such as `tools/list`, the rules run once for each item in the response. In each run, `mcp.methodName` is the list method, and the target field, such as `mcp.tool`, contains that item. Any item that no rule allows is removed from the list. A rule that checks only the tool, such as `mcp.tool.name == "echo"`, therefore both lists `echo` and allows calls to it. To give listing and calling different access, check `mcp.methodName` in the rule. The following rules let every client see all tools, but let only `test-user` call them. Because no rule matches the prompt or resource methods, prompts and resources are removed from list responses, and requests for them, such as `prompts/get` and `resources/read`, are denied.

```yaml
mcpAuthorization:
  rules:
  # Anyone can see every tool in the tools/list response
  - 'mcp.methodName == "tools/list"'
  # Only test-user can call tools
  - 'mcp.methodName == "tools/call" && jwt.sub == "test-user"'
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
