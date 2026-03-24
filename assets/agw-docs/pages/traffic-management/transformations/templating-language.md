{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} transformation templates are written in Common Expression Language (CEL). CEL is a fast, portable, and safely executable language that goes beyond declarative configurations. CEL lets you develop more complex expressions in a readable, developer-friendly syntax.

CEL transformations allow you to use dynamic expressions to extract and transform values from requests and responses. You can apply them to routes for LLM providers, MCP servers, inference services, and agents.

To learn more about how to use CEL, refer to the following resources:

* [CEL reference]({{< link-hextra path="/reference/cel/" >}})
* [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)



## Where can CEL be used?

Transformations operate on three targets: request headers, response headers, and response bodies. Each target supports `set`, `add`, and `remove` operations, and you can combine them in a single policy.

### Adjust request headers

Use `request.set` to modify the headers sent to the upstream service. CEL expressions can reference any request context variable.

```yaml
traffic:
  transformation:
    request:
      set:
      - name: x-forwarded-uri
        value: 'request.scheme + "://" + request.host + request.path'
```

For more information, see [Create redirect URLs]({{< link-hextra path="/traffic-management/transformations/redirect/" >}}).

### Adjust response headers

Modify the response headers returned to the client. 

```yaml
traffic:
  transformation:
    response:
      set:
      - name: x-user-id-encoded
        value: 'base64.encode(bytes(request.headers["x-user-id"]))'
      - name: ":status"
        value: 'request.uri.contains("foo=bar") ? 401 : 403'
      remove:
      - access-control-allow-credentials
```

For more information, see [Encode and decode base64 headers]({{< link-hextra path="/traffic-management/transformations/encode/" >}}).

### Adjust the response body

Rreplace the entire response body with a CEL expression that evaluates to a string. This example builds a JSON response body from the request path and method. This is useful for constructing structured responses from request data.

```yaml
traffic:
  transformation:
    response:
      body: '"{\"path\": \"" + request.path + "\", \"method\": \"" + request.method + "\"}"'
```

For more information, see [Inject response body]({{< link-hextra path="/traffic-management/transformations/inject-response-body/" >}}).


## CEL syntax quick reference {#cel-syntax}

The following examples show common CEL patterns used in transformations.

| Pattern | Example | Use case | Notes |
|---------|---------|----------|-------|
| String literal | `'"hello"'` | Inject a fixed value into a header or body. | Wrap in single quotes in YAML. |
| Variable | `request.path` | Forward a request property as-is, such as echoing the path into a header. | No quotes needed. |
| Concatenation | `'"prefix-" + request.path'` | Build a value from a mix of static text and dynamic variables, such as constructing a URL or adding a namespace prefix to a header value. | Wrap in single quotes in YAML. |
| Ternary | `'request.headers["x-foo"] == "bar" ? "yes" : "no"'` | Conditionally set a value based on a request property, such as changing a response status code when a specific query parameter is present. The pattern is `condition ? value_if_true : value_if_false`. In the example, if the `x-foo` header equals `"bar"`, the expression returns `"yes"`; otherwise it returns `"no"`. | Wrap in single quotes in YAML. Both sides must be the same type, such as strings or integers on both sides. |
| Map access | `'request.headers["x-my-header"]'` | Read the value of a specific request header and forward it or use it in another expression. | Wrap in single quotes in YAML. |

**YAML quoting:** When a CEL expression is a string literal or starts with a quote, wrap it in single quotes in YAML so the inner double quotes are preserved:



## Context variables {#context-variables}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel.md" section="CEL context Schema" %}}

{{< callout type="warning" >}}
JWT claims (`jwt.*`) are not available in transformations in agentgateway. This is a known limitation being tracked. Check the agentgateway release notes for updates.
{{< /callout >}}

## Built-in functions {#cel-functions}




{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

### Function examples

These functions are used in the documentation examples in this section. 
- [`base64.encode(bytes)`]({{< link-hextra path="/traffic-management/transformations/add-response-headers/" >}})
- [`base64.decode(string)`]({{< link-hextra path="/traffic-management/transformations/add-response-headers/" >}})
- [`expression.with(variable, result)`]({{< link-hextra path="/traffic-management/transformations/normalize-path/" >}})
- [`random()`]({{< link-hextra path="/traffic-management/transformations/inject-response-headers/" >}})
- [`string(value)`]({{< link-hextra path="/traffic-management/transformations/inject-response-headers/" >}})
- [`string.regexReplace(pattern, replacement)`]({{< link-hextra path="/traffic-management/transformations/normalize-path/" >}})
- [`uuid()`]({{< link-hextra path="/traffic-management/transformations/combine/" >}})

## Transformation phases {#phases}

Transformations in `spec.traffic` support a `phase` field that controls when the policy is evaluated in the request lifecycle. If `phase` is omitted, `PostRouting` is used. 

| Phase | Description | Valid target types |
|-------|-------------|-------------------|
| `PostRouting` | Default. Transformations are applied after the routing decision is made. | Gateway, Listener, HTTPRoute |
| `PreRouting` | Transformations are applied before the routing decision is made. Useful for gateway-level gates that apply to all routes. | Gateway, Listener |

Example:
```yaml  {hl_lines=[7]}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: http
  traffic:
    phase: PreRouting
    transformation:
      request:
        set:
        - name: x-phase
          value: '"pre-routing"'
```
