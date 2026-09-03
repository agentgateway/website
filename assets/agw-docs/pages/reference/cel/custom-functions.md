Define custom {{< gloss "CEL (Common Expression Language)" >}}Common Expression Language (CEL){{< /gloss >}} functions to reuse expression logic across policies, transformations, logging, tracing, and other CEL-enabled settings. A custom function is a named CEL expression, not native code, so it has the same data access and safety model as the expression that calls it.

Custom functions are part of the static agentgateway configuration. They are registered when the process starts, before any other CEL expression is compiled.

## Define and call a function

Set `config.customFunctions` to a YAML block string. Each definition has a name, parameters in parentheses, and one CEL expression between braces.

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

The function uses the CEL context of its caller. For example, `request` in an authorization function is the request available to that authorization policy. If a function reads `response`, callers can use it only in policy phases where `response` is available. For the context in each phase, see [Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}).

## Reuse functions across policies

The following routing-based configuration defines two functions. The authorization policy calls both functions, and the transformation policy reuses `isInternal` to set a request header.

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
config:
  customFunctions: |
    hasHeader(name) {
      request.headers.contains(name)
    }

    between(value, minimum, maximum) {
      value >= minimum && value <= maximum
    }
```

Call these functions as `hasHeader("x-tenant")` and `between(llm.inputTokens, 1, 4096)`. The `llm` variables are bound only on AI and LLM routes, so a call such as `between(llm.inputTokens, 1, 4096)` works only in a policy on one of those routes.

### Receiver functions

Prefix the name with `this.` to define a receiver function. The value before the function name is available as `this` in the body.

```yaml
config:
  customFunctions: |
    this.hasTenantPrefix(tenant) {
      this.startsWith("/tenants/" + tenant + "/")
    }
```

Call the function as `request.path.hasTenantPrefix("acme")`.

### Variadic functions

Add `...` to the final parameter to accept zero or more trailing arguments. The function receives those arguments as a CEL list.

```yaml
config:
  customFunctions: |
    this.joined(prefix, parts...) {
      prefix + this + parts.join("")
    }
```

For example, `"gateway".joined("agent", "-", "docs")` returns `"agentgateway-docs"`.

### Functions that call functions

A custom function can call another custom function, including one defined later in the block.

```yaml
config:
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

Validation covers the definitions themselves, such as their names, parameters, and call graph. It does not cover whether each call site can supply the variables that the function reads. For that class of error, see [Context variables are not validated](#context-variables-are-not-validated).

After you start agentgateway with the configuration, its custom functions are also available in the [CEL playground]({{< link-hextra path="/reference/cel/playground/" >}}). Use the playground to supply a request context and evaluate individual calls, such as `isInternal()`.

Because `config.customFunctions` is static, restart agentgateway after you add, remove, or change a definition. A dynamic policy update can call an existing custom function, but it cannot register a new one.

## Naming and evaluation constraints

The following constraints are checked when the functions are registered, which happens both at startup and during `--validate-only` validation. A configuration that breaks one of them is rejected with an error.

| Constraint | Behavior |
| -- | -- |
| Names and parameters | Use ASCII letters, numbers, and underscores. The first character must be a letter or underscore. |
| `this` | Reserved for receiver values and cannot be a function name or parameter. |
| Duplicate names | You cannot define the same name more than once, even with different parameters. A receiver function is registered under its bare name, so `example()` and `this.example()` collide with each other. |
| Built-in names | A custom function cannot replace a built-in CEL or agentgateway function. |
| Variadic parameters | Only the final parameter can be variadic, and a function can have only one variadic parameter. |
| Recursion | Direct and indirect recursion are not supported. |

### Context variables are not validated

> [!WARNING]
> Neither startup nor `--validate-only` checks that a function's variables are available where the function is called. A mismatch surfaces only when a request arrives, and the request fails.

The following configuration passes `--validate-only` and starts successfully, even though `response` is not bound when an authorization policy runs.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  customFunctions: |
    wasOk() {
      response.code == 200
    }
gateways:
  default:
    port: 3000
routes:
- policies:
    authorization:
      rules:
      - allow: 'wasOk()'
  backends:
  - host: localhost:8080
```

Every request to that route then fails the `allow` rule and receives a `403` response, because the expression cannot resolve `response`. Nothing in the startup logs reports the problem.

Before you call a function from a new policy, confirm that every variable that the function reads is bound in that policy's phase. For the variables in each phase, see [Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}).

## Reference

For all built-in functions and context variables, see [Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}). For the `config.customFunctions` field schema, see the [Configuration schema explorer]({{< link-hextra path="/reference/configuration/schema/" >}}).
