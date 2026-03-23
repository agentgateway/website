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


## CEL variables in access logs {#cel-log}

When building or debugging transformations, you can log CEL variables to inspect what values are available at runtime. Configure this in your Helm values under `agentgateway.config.logging.fields.add`. Each entry maps a log field name to a CEL expression that is evaluated per request and written to the structured access log.

Save your logging config to a `values.yaml` file and apply it with `helm upgrade`:

```sh
helm upgrade -i -n agentgateway-system agentgateway \
  oci://cr.agentgateway.dev/charts/agentgateway \
  -f values.yaml
```

#### Log all variables

Use the `variables()` function to dump the full CEL context as a JSON object under a single log field. This is useful when you are unsure which variables are available.

```yaml
# values.yaml
agentgateway:
  config:
    logging:
      fields:
        add:
          cel: variables()
  enabled: true
```

This adds a `cel` field to every access log entry containing all available context variables. To view the logs, run:

```sh
kubectl logs -n agentgateway-system -l app.kubernetes.io/name=agentgateway | grep cel
```

Example log output:

```json
{
  "cel": {
    "request.path": "/get",
    "request.method": "GET",
    "request.scheme": "http",
    "request.host": "www.example.com",
    "source.address": "10.244.0.6"
  }
}
```

#### Log specific variables

To keep logs concise, you can log individual variables by name instead of the full context.

```yaml
# values.yaml
agentgateway:
  config:
    logging:
      fields:
        add:
          request_path: request.path
          request_method: request.method
          client_ip: source.address
  enabled: true
```

The field names on the left (`request_path`, `request_method`, `client_ip`) are arbitrary. The names become the keys in the structured log output.




