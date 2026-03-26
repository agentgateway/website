{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} transformation templates are written in Common Expression Language (CEL). CEL is a fast, portable, and safely executable language that goes beyond declarative configurations. With CEL,  you can develop more complex expressions in a readable, developer-friendly syntax and use them to extract and transform values from requests and responses. 

You can apply CEL transformations to routes for LLM providers, MCP servers, inference services, agents, and HTTP services.



## Where can CEL be used?

Transformations operate on three targets: request headers, response headers, and response bodies. Each target supports `set`, `add`, and `remove` operations, and you can combine them in a single policy.

### Adjust request headers

Use the `request` transformation to add, overwrite, or remove headers before the request reaches the upstream service. This transformation is useful for injecting routing hints, auth context, or tracing metadata that the upstream expects but the client does not send.

```yaml
traffic:
  transformation:
    request:
      set:
      - name: x-forwarded-uri
        value: 'request.scheme + "://" + request.host + request.path'
```

For more information about this example, see [Create redirect URLs]({{< link-hextra path="/traffic-management/transformations/forward/" >}}).

### Adjust response headers

Use the `response` transformation to add, overwrite, or remove headers before the response reaches the client. This transformation is useful for encoding sensitive values, setting custom status codes, or stripping internal headers that should not be exposed.

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

For more information about this example, see [Encode and decode base64 headers]({{< link-hextra path="/traffic-management/transformations/encode/" >}}).

### Adjust the response body

Use the `response.body` transformation to replace the entire response body with a CEL expression that evaluates to a string. This transformation is useful when the upstream response needs to be reformatted or enriched before it reaches the client. For example, you might want to build a structured JSON response from request data or inject values from request context into the body.

```yaml
traffic:
  transformation:
    response:
      body: '"{\"path\": \"" + request.path + "\", \"method\": \"" + request.method + "\"}"'
```

For more information about this example, see [Inject response bodies]({{< link-hextra path="/traffic-management/transformations/inject-response-body/" >}}).


## CEL syntax quick reference {#cel-syntax}

Use these patterns to build expressions for header values, body content, and conditional logic in your transformation policies.

| Pattern | Example | Use case | Notes |
|---------|---------|----------|-------|
| String literal | `'"hello"'` | Inject a fixed value into a header or body. | Wrap in single quotes in YAML. |
| Variable | `request.path` | Forward a request property as-is, such as echoing the path into a header. | No quotes needed. |
| Concatenation | `'"prefix-" + request.path'` | Build a value from a mix of static text and dynamic variables, such as constructing a URL or adding a namespace prefix to a header value. | Wrap in single quotes in YAML. |
| Conditional expression | `'request.headers["x-foo"] == "bar" ? "yes" : "no"'` | Conditionally set a value based on a request property, such as changing a response status code when a specific query parameter is present. The pattern is `condition ? value_if_true : value_if_false`. In the example, if the `x-foo` header equals `"bar"`, the expression returns `"yes"`; otherwise it returns `"no"`. | Wrap in single quotes in YAML. Both sides must be the same type, such as strings or integers on both sides. |
| Header lookup | `'request.headers["x-my-header"]'` | Read the value of a specific request header and forward it or use it in another expression. | Wrap in single quotes in YAML. |

**YAML quoting:** When a CEL expression is a string literal or starts with a quote, wrap it in single quotes in YAML so the inner double quotes are preserved:



## Context variables {#context-variables}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel.md" section="CEL context Schema" %}}


## Built-in functions {#cel-functions}

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

### Function examples

These functions are used in the documentation examples in this section.
- [`base64.encode(bytes)`]({{< link-hextra path="/traffic-management/transformations/encode/" >}})
- [`base64.decode(string)`]({{< link-hextra path="/traffic-management/transformations/encode/" >}})
- [`bytes(string)`]({{< link-hextra path="/traffic-management/transformations/encode/" >}})
- [`default(expression, fallback)`]({{< link-hextra path="/traffic-management/transformations/validate/" >}})
- [`expression.with(variable, result)`]({{< link-hextra path="/traffic-management/transformations/rewrite/" >}})
- [`fail()`]({{< link-hextra path="/traffic-management/transformations/validate/" >}})
- [`json(string)`]({{< link-hextra path="/traffic-management/transformations/inject-response-body/" >}})
- [`map.filterKeys(k, predicate)`]({{< link-hextra path="/traffic-management/transformations/filter-request-body/" >}})
- [`map.merge(map2)`]({{< link-hextra path="/traffic-management/transformations/filter-request-body/" >}})
- [`random()`]({{< link-hextra path="/traffic-management/transformations/tracing/" >}})
- [`string(value)`]({{< link-hextra path="/traffic-management/transformations/encode/" >}})
- [`toJson(value)`]({{< link-hextra path="/traffic-management/transformations/filter-request-body/" >}})
- [`string.contains(substring)`]({{< link-hextra path="/traffic-management/transformations/change-response-body/" >}})
- [`string.regexReplace(pattern, replacement)`]({{< link-hextra path="/traffic-management/transformations/rewrite/" >}})
- [`uuid()`]({{< link-hextra path="/traffic-management/transformations/tracing/" >}})
- [`variables()`]({{< link-hextra path="/traffic-management/transformations/access-logs/" >}})

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

## Next steps

To learn more about how to use CEL, refer to the following resources:

* [CEL reference]({{< link-hextra path="/reference/cel/" >}})
* [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)