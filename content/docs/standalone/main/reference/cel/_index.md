---
title: CEL expressions
weight: 2
description: CEL expression language reference for agentgateway policies.
---

Agentgateway uses the {{< gloss "CEL (Common Expression Language)" >}}CEL{{< /gloss >}} expression language throughout the project to enable flexibility.
CEL allows writing simple expressions based on the request context that evaluate to some result.

## CEL playground

You can try out CEL expressions directly in the built-in CEL playground in the agentgateway admin UI. The playground uses agentgateway's actual CEL runtime, so custom functions and variables specific to agentgateway are available for testing.

To open the playground:

1. Run agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

2. Open the [CEL playground](http://localhost:15000/ui/cel/). 

3. In the **Expression** box, enter the CEL expression that you want to test. 
4. In the **Input Data (YAML)** box, paste the YAML file structure that the CEL expression is running against. 
5. To test your CEL expression, click **Evaluate**. 

{{< reuse-image src="img/cel-playground.png" >}}
{{< reuse-image-dark srcDark="img/cel-playground-dark.png" >}}

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

{{< gloss "JWT (JSON Web Token)" >}}JWT{{< /gloss >}} claim fallback with example of default "user" role:

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

## CEL in YAML

When writing CEL expressions in agentgateway, typically they are expressed as YAML string values, which can cause confusion.
Any string literals within the expression need to be escaped with additional quotes.

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

## Context reference

When using CEL expressions, a variety of variables and functions are made available.

### Variables

Variables are only available when they exist in the current context. Previously in version 0.11 or earlier, variables like `jwt` were always present but could be `null`. Now, to check if a JWT claim exists, use the expression `has(jwt.sub)`. This expression returns `false` if there is no JWT, rather than always returning `true`.

Additionally, fields are populated only if they are referenced in a CEL expression.
This way, agentgateway avoids expensive buffering of request bodies if no CEL expression depends on the `body`.

Each policy execution consistently gets the current view of the request and response. For example, during logging, any manipulations from earlier policies (such as transformations or external processing) are observable in the CEL context.

#### Table of variables

The auto-generated [CEL expression context](cel-context/) page documents all available fields from the JSON schema.

#### Variables by policy type

Depending on the policy, different fields are accessible based on when in the request processing they are applied.

|Policy|Available Variables|
|------|-------------------|
|Transformation| `source`, `request`, `jwt`, `extauthz` |
|Remote Rate Limit| `source`, `request`, `jwt` |
|HTTP Authorization| `source`, `request`, `jwt` |
|External Authorization| `source`, `request`, `jwt` |
|MCP Authorization| `source`, `request`, `jwt`, `mcp` |
|Logging| `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm`|
|Tracing| `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm`|
|Metrics| `source`, `request`, `jwt`, `mcp`, `extauthz`, `response`, `llm`|

### Functions {#functions-policy-all}

The following functions can be used in all policy types.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Standard Functions" %}}
