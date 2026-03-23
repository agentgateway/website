{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} transformation templates are written in Common Expression Language (CEL). CEL is a fast, portable, and safely executable language that goes beyond declarative configurations. CEL lets you develop more complex expressions in a readable, developer-friendly syntax.

CEL transformations allow you to use dynamic expressions to extract and transform values from requests and responses. You can apply them to routes for LLM providers, MCP servers, inference services, and agents.

To learn more about how to use CEL, refer to the following resources:

* [CEL reference](/reference/cel/)
* [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)


## CEL syntax quick reference {#cel-syntax}

The following examples show common CEL patterns used in transformations.

| Pattern | Example | Notes |
|---------|---------|-------|
| String literal | `"hello"` | Must use single-quoted string in YAML: `'"hello"'` |
| Variable | `request.path` | No quotes needed |
| Concatenation | `"prefix-" + request.path` | Use `+` to join strings |
| Ternary | `request.headers["x-foo"] == "bar" ? "yes" : "no"` | Condition `?` true-value `:` false-value |
| Map access | `request.headers["x-my-header"]` | Use bracket notation for headers |

**YAML quoting:** When a CEL expression is a string literal or starts with a quote, wrap it in single quotes in YAML so the inner double quotes are preserved:

```yaml
value: '"static string"'       # CEL string literal
value: '"prefix-" + request.path'  # concatenation starting with literal
value: request.path             # bare variable — no extra quoting needed
```

## Context variables {#context-variables}

The following variables are available in CEL transformation expressions:

| Variable | Description |
|----------|-------------|
| `request.path` | The request URI path (e.g., `/v1/chat/completions`) |
| `request.pathAndQuery` | The request path and query string (e.g., `/path?foo=bar`) |
| `request.method` | The HTTP method (e.g., `"GET"`, `"POST"`) |
| `request.scheme` | The request scheme (e.g., `"http"`, `"https"`) |
| `request.host` | The hostname of the request (e.g., `"example.com"`) |
| `request.uri` | The complete URI of the request (e.g., `"http://example.com/path"`) |
| `request.version` | The HTTP version (e.g., `"HTTP/1.1"`) |
| `request.headers["name"]` | Value of a request header by name (case-insensitive) |
| `request.body` | The raw request body as a string |
| `source.address` | The IP address of the downstream client |
| `jwt.sub` | The `sub` claim from a verified JWT |
| `jwt.iss` | The `iss` claim from a verified JWT |
| `jwt['custom-claim']` | Any custom claim from a verified JWT |

{{< callout type="warning" >}}
JWT claims (`jwt.*`) are not available in transformations in agentgateway v2.1.x. This is a known limitation being tracked. Check the agentgateway release notes for updates.
{{< /callout >}}

## Built-in functions {#cel-functions}

The following built-in functions are available in CEL transformation expressions:

| Function | Returns | Description |
|----------|---------|-------------|
| `uuid()` | `string` | Generates a random UUIDv4 string |
| `random()` | `float` | Generates a random float between `0.0` and `1.0` |
| `string(value)` | `string` | Converts a value to its string representation |
| `base64.encode(bytes)` | `string` | Encodes a value to base64 |
| `base64.decode(string)` | `bytes` | Decodes a base64-encoded string |

### Log CEL variables in agentgateway {#cel-log}

You can log the full context of the CEL variables by [upgrading your Helm installation settings]({{< link-hextra path="/operations/upgrade/">}}), such as the following example:

```yaml
agentgateway:
  config:
    logging:
      fields:
        add:
          cel: variables()
  enabled: true
```




