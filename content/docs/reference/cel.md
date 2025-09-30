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

JWT claim default "user" role:

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

As you write expressions, keep the following context in mind.

### Functions and variables {#functions-and-variables}

When using CEL in agentgateway, you can use the following variables and functions.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/README.md" section="CEL context" %}}

### Functions by policy type {#fields-by-policy}

Certain fields are populated only if they are referenced in a CEL expression.
This way, agentgateway avoids expensive buffering of request bodies if no CEL expression depends on the `body`.

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

### Functions for all policy types {#functions-policy-all}

The following functions can be used in all policy types.

| Function            | Purpose                                                                                                                                                                                                                                                                          |
|---------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `json`              | Parse a string or bytes as JSON. Example: `json(request.body).some_field`.                                                                                                                                                                                                       |
| `with`              | CEL does not allow variable bindings. `with` allows doing this. Example: `json(request.body).with(b, b.field_a + b.field_b)`                                                                                                                                                      |
| `variables`         | `variables` exposes all of the variables available as a value. CEL otherwise does not allow accessing all variables without knowing them ahead of time. Warning: this automatically enables all fields to be captured.                                                           |
| `map_values`        | `map_values` applies a function to all values in a map. `map` in CEL only applies to map keys.                                                                                                                                                                                   |
| `flatten`           | Usable only for logging and tracing. `flatten` will flatten a list or struct into many fields. For example, defining `headers: 'flatten(request.headers)'` would log many keys like `headers.user-agent: "curl"`, etc.                                                           |
| `flatten_recursive` | Usable only for logging and tracing. Like `flatten` but recursively flattens multiple levels.                                                                                                                                                                                    |
| `base64_encode`     | Encodes a string to a base64 string. Example: `base64_encode("hello")`.                                                                                                                                                                                                          |
| `base64_decode`     | Decodes a string in base64 format. Example: `string(base64_decode("aGVsbG8K"))`. Warning: this returns `bytes`, not a `String`. Various parts of agentgateway will display bytes in base64 format, which may appear like the function does nothing if not converted to a string. |
| `random`            | Generates a number float from 0.0-1.0                                                                                                                                                                                                                                            |

### Standard functions {#standard-functions}

Additionally, the following standard functions are available for all policy types, too.

* `contains`, `size`, `has`, `map`, `filter`, `all`, `max`, `startsWith`, `endsWith`, `string`, `bytes`, `double`, `exists`, `exists_one`, `int`, `uint`, `matches`.
* Duration/time functions: `duration`, `timestamp`, `getFullYear`, `getMonth`, `getDayOfYear`, `getDayOfMonth`, `getDate`, `getDayOfWeek`, `getHours`, `getMinutes`, `getSeconds`, `getMilliseconds`.
* From the [strings extension](https://pkg.go.dev/github.com/google/cel-go/ext#Strings): `charAt`, `indexOf`, `join`, `lastIndexOf`, `lowerAscii`, `upperAscii`, `trim`, `replace`, `split`, `substring`.
