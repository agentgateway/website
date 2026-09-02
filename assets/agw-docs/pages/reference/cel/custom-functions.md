Define custom Common Expression Language (CEL) functions to reuse expression
logic across policies, transformations, logging, tracing, and other
CEL-enabled settings. A custom function is a named CEL expression, not native
code, so it has the same data access and safety model as the expression that
calls it.

Custom functions are part of the static agentgateway configuration. Agentgateway
registers them when the process starts, before it compiles any other CEL
expressions.

## Define and call a function

Set `config.customFunctions` to a YAML block string. Each definition has a
name, parameters in parentheses, and one CEL expression between braces.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  customFunctions: |
    isInternal() {
      request.headers["x-env"] == "internal"
    }

    callerTier(defaultTier) {
      default(request.headers["x-tier"], defaultTier)
    }
```

Call the functions by name from any CEL expression.

```yaml
policies:
  authorization:
    rules:
    - allow: 'isInternal()'
  transformations:
    request:
      add:
        x-caller-tier: 'callerTier("standard")'
```

The function uses the CEL context of its caller. For example, `request` in an
authorization function is the request available to that authorization policy.
If a function reads `response`, callers can use it only in policy phases where
`response` is available. For the context in each phase, see
[Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}).

## Reuse functions across policies

The following routing-based configuration defines two functions. The
authorization policy calls both functions, and the transformation policy
reuses `isInternal` to set a request header.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  customFunctions: |
    isInternal() {
      request.headers["x-env"] == "internal"
    }

    this.hasTenantPrefix(tenant) {
      this.startsWith("/tenants/" + tenant + "/")
    }
gateways:
  default:
    port: 3000
routes:
- policies:
    authorization:
      rules:
      - allow: 'isInternal() || request.path.hasTenantPrefix("acme")'
    transformations:
      request:
        add:
          x-internal-request: 'string(isInternal())'
  backends:
  - host: localhost:8080
```

{{< doc-test paths="custom-cel-functions" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  customFunctions: |
    isInternal() {
      request.headers["x-env"] == "internal"
    }

    this.hasTenantPrefix(tenant) {
      this.startsWith("/tenants/" + tenant + "/")
    }
gateways:
  default:
    port: 3000
routes:
- policies:
    authorization:
      rules:
      - allow: 'isInternal() || request.path.hasTenantPrefix("acme")'
    transformations:
      request:
        add:
          x-internal-request: 'string(isInternal())'
  backends:
  - host: localhost:8080
EOF

agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## Function forms

Use the function form that fits how you want to call the expression.

### Global functions

A global function can take zero or more parameters.

```yaml
customFunctions: |
  hasHeader(name) {
    request.headers.contains(name)
  }

  between(value, minimum, maximum) {
    value >= minimum && value <= maximum
  }
```

Call these functions as `hasHeader("x-tenant")` and
`between(llm.inputTokens, 1, 4096)`.

### Receiver functions

Prefix the name with `this.` to define a receiver function. The value before
the function name is available as `this` in the body.

```yaml
customFunctions: |
  this.hasTenantPrefix(tenant) {
    this.startsWith("/tenants/" + tenant + "/")
  }
```

Call the function as `request.path.hasTenantPrefix("acme")`.

### Variadic functions

Add `...` to the final parameter to accept zero or more trailing arguments.
The function receives those arguments as a CEL list.

```yaml
customFunctions: |
  this.joined(prefix, parts...) {
    prefix + this + parts.join("")
  }
```

For example, `"gateway".joined("agent", "-", "docs")` returns
`"agentgateway-docs"`.

### Functions that call functions

A custom function can call another custom function, including one defined
later in the block.

```yaml
customFunctions: |
  canAccessTenant(tenant) {
    isInternal() || request.path.hasTenantPrefix(tenant)
  }

  isInternal() {
    request.headers["x-env"] == "internal"
  }

  this.hasTenantPrefix(tenant) {
    this.startsWith("/tenants/" + tenant + "/")
  }
```

## Validate and test functions

Validate the complete configuration before starting agentgateway.

```sh
agentgateway -f config.yaml --validate-only
```

After you start agentgateway with the configuration, its custom functions are
also available in the [CEL playground]({{< link-hextra path="/reference/cel/playground/" >}}).
Use the playground to supply a request context and evaluate individual calls,
such as `isInternal()`.

Because `config.customFunctions` is static, restart agentgateway after you add,
remove, or change a definition. A dynamic policy update can call an existing
custom function, but it cannot register a new one.

## Naming and evaluation constraints

Agentgateway rejects invalid custom functions during startup or
`--validate-only` validation.

| Constraint | Behavior |
| -- | -- |
| Names and parameters | Use letters, numbers, and underscores. The first character must be a letter or underscore. |
| `this` | Reserved for receiver values and cannot be a function name or parameter. |
| Duplicate names | You cannot define the same name more than once, even with different parameters. |
| Built-in names | A custom function cannot replace a built-in CEL or agentgateway function. |
| Variadic parameters | Only the final parameter can be variadic, and a function can have only one variadic parameter. |
| Recursion | Direct and indirect recursion are not supported. |
| Context variables | A call fails if its function uses a variable that is unavailable in the caller's policy phase. |

For all built-in functions and context variables, see
[Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}).
For the `config.customFunctions` field schema, see the
[Configuration schema explorer]({{< link-hextra path="/reference/configuration/schema/" >}}).
