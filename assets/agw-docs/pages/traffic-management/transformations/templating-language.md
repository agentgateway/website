{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} transformation templates are written in Common Expression Language (CEL). CEL is a fast, portable, and safely executable language that goes beyond declarative configurations. With CEL,  you can develop more complex expressions in a readable, developer-friendly syntax and use them to extract and transform values from requests and responses. 

You can apply CEL transformations to routes for LLM providers, MCP servers, inference services, agents, and HTTP services.



## Where can CEL be used?

Transformations can modify the headers and body of a request or response. Each transformation is expressed as static values, built-in CEL functions, or context variables to extract and inject information.


{{< reuse "agw-docs/snippets/trafficpolicy.md" >}} structure for transformations:
```yaml
traffic:
  transformation:
    request:
      set:
      add: 
      remove:
      body:
      metadata:
    response: 
      set:
      add: 
      remove:
      body:
      metadata:
```

### Header transformations

Use header transformations to add, overwrite, or remove headers on a request before it reaches the upstream, or on a response before it reaches the client. Three operations are supported:

* `set`: Creates a header or overwrites it if it already exists.
* `add`: Appends a value to a header without removing existing values.
* `remove`: Strips a header entirely.

Each `set` or `add` entry takes a `name` and a `value`. The value is a CEL expression that can be a static string, a call to a built-in function, or a reference to a context variable such as `request.headers["x-foo"]`, `jwt.sub`, or `llm.requestModel`.

You might use these transformations for injecting routing hints, auth context, or tracing metadata that the upstream expects but the client does not send.

Request header example to build a forwarded URI from context variables:

```yaml
traffic:
  transformation:
    request:
      set:
      - name: x-forwarded-uri
        value: 'request.scheme + "://" + request.host + request.path'
```



For another request header example, see [Create redirect URLs]({{< link-hextra path="/traffic-management/transformations/forward/" >}}).

Response header example to encode a header value with a CEL function, set a dynamic status code with a conditional expression, and remove a header:

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



For another response header example, see [Inject response headers]({{< link-hextra path="/traffic-management/transformations/inject-response-headers/" >}}).

### Body transformations

Use body transformations to replace the entire body of a request or response with a new value. The `body` field takes a single CEL expression that must evaluate to a string. You can build the new body from static values, CEL functions such as `json()` and `toJson()`, or context variables such as `request.body` or `response.body`.

Response body example to construct a JSON response body from request context variables:

```yaml
traffic:
  transformation:
    response:
      body: '"{\"path\": \"" + request.path + "\", \"method\": \"" + request.method + "\"}"'
```

For more information, see [Inject response bodies]({{< link-hextra path="/traffic-management/transformations/inject-response-body/" >}}).

Request body example to strip internal fields and merge in defaults before forwarding:

```yaml
traffic:
  transformation:
    request:
      body: 'toJson(json(request.body).filterKeys(k, !k.startsWith("x_")).merge({"model": "gpt-4o", "max_tokens": 2048}))'
```

For more information, see [Filter and merge request body fields]({{< link-hextra path="/traffic-management/transformations/filter-request-body/" >}}).

### Pre-compute values with metadata

Use the `metadata` field to evaluate a CEL expression once and make the result available as `metadata.<name>` in the `set`, `add`, and `body` fields of the same transformation. `metadata` keys are evaluated before any other fields in the transformation, so they can be referenced anywhere in the same block.

This field is useful when the same complex expression would otherwise be repeated. For example, if you parse a JSON body field to inject it as a header and also use it in a condition, writing it twice creates noise and a maintenance risk. With `metadata`, you write it once.

```yaml
traffic:
  transformation:
    response:
      metadata:
        parsedModel: 'string(json(response.body).model)'
      set:
      - name: x-actual-model
        value: metadata.parsedModel
      - name: x-model-changed
        value: 'metadata.parsedModel != string(json(request.body).model) ? "true" : "false"'
```

`metadata` values are only available within the same transformation block. They are not accessible in access log or tracing CEL expressions.

For a full example, see [Inject LLM model headers]({{< link-hextra path="/traffic-management/transformations/llm-model-headers/" >}}).


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

Context variables give CEL expressions access to information about the current request, response, and connection. They are populated automatically by agentgateway at runtime so you do not need to declare or configure them. Use them to read values such as headers, path, method, JWT claims, or LLM model names and inject them into headers, bodies, or conditions.

Variables are only populated when they are relevant to the current request. For example, `jwt` is only present when a JWT has been validated, and `llm` is only present when the route is backed by an LLM provider. Referencing an absent variable in a CEL expression produces an error. Use `default(expression, fallback)` to avoid this error.

Not all variables are available in every policy type. The table below lists which variables are available depending on where the CEL expression is evaluated.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel.md" section="CEL context Schema" %}}


## Built-in functions {#cel-functions}

Built-in functions extend CEL with capabilities that go beyond simple variable access and arithmetic. Use them to parse and serialize data, encode values, generate identifiers, and manipulate strings and maps. For example, `json()` parses a raw request body string into a map so you can access individual fields, `base64.encode()` encodes a header value for safe transmission, and `default()` provides a fallback when a variable might not be present.

The output of one function can be passed as the input of another. For example, `string(json(request.body).model)` parses the body, extracts the `model` field, and converts the result to a string in a single expression.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/cel-functions.md" section="Functions" %}}

### Function examples

These functions are used in the documentation examples in this section.

| Function | Example topic |
|----------|---------------|
| `base64.encode(bytes)` | [Encode base64]({{< link-hextra path="/traffic-management/transformations/encode/" >}}) |
| `base64.decode(string)` | [Encode base64]({{< link-hextra path="/traffic-management/transformations/encode/" >}}) |
| `bytes(string)` | [Encode base64]({{< link-hextra path="/traffic-management/transformations/encode/" >}}) |
| `default(expression, fallback)` | [Validate and set request body defaults]({{< link-hextra path="/traffic-management/transformations/validate/" >}}) |
| `expression.with(variable, result)` | [Rewrite dynamic path segments]({{< link-hextra path="/traffic-management/transformations/rewrite/" >}}) |
| `fail()` | [Validate and set request body defaults]({{< link-hextra path="/traffic-management/transformations/validate/" >}}) |
| `json(string)` | [Inject response bodies]({{< link-hextra path="/traffic-management/transformations/inject-response-body/" >}}) |
| `map.filterKeys(k, predicate)` | [Filter and merge request body fields]({{< link-hextra path="/traffic-management/transformations/filter-request-body/" >}}) |
| `map.merge(map2)` | [Filter and merge request body fields]({{< link-hextra path="/traffic-management/transformations/filter-request-body/" >}}) |
| `metadata.<name>` | [Inject LLM model headers]({{< link-hextra path="/traffic-management/transformations/llm-model-headers/" >}}) |
| `random()` | [Generate request tracing headers]({{< link-hextra path="/traffic-management/transformations/tracing/" >}}) |
| `string(value)` | [Encode base64]({{< link-hextra path="/traffic-management/transformations/encode/" >}}) |
| `string.contains(substring)` | [Change response body]({{< link-hextra path="/traffic-management/transformations/change-response-body/" >}}) |
| `string.regexReplace(pattern, replacement)` | [Rewrite dynamic path segments]({{< link-hextra path="/traffic-management/transformations/rewrite/" >}}) |
| `toJson(value)` | [Filter and merge request body fields]({{< link-hextra path="/traffic-management/transformations/filter-request-body/" >}}) |
| `uuid()` | [Generate request tracing headers]({{< link-hextra path="/traffic-management/transformations/tracing/" >}}) |
| `variables()` | [Enrich access logs]({{< link-hextra path="/traffic-management/transformations/access-logs/" >}}) |

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