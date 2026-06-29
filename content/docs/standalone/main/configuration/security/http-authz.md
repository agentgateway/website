---
title: HTTP authorization
weight: 12
description: Define allow, deny, and require rules using CEL expressions.
test:
  http-authz:
  - file: content/docs/standalone/main/configuration/security/http-authz.md
    path: http-authz
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="http-authz" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

HTTP {{< gloss "Authorization (AuthZ)" >}}authorization{{< /gloss >}} allows defining rules to allow or deny requests based on their properties, using [CEL expressions]({{< link-hextra path="/reference/cel/" >}}).

{{< callout type="info" >}}
Try out CEL expressions in the built-in [CEL playground]({{< link-hextra path="/reference/cel/playground/" >}}) in the agentgateway admin UI before using them in your configuration.
{{< /callout >}}

Policies can define `allow`, `deny`, and `require` rules. Rules are evaluated in this order of precedence:
1. If there are no rules, the request is allowed.
2. If any `deny` rule matches, the request is denied.
3. If any `require` rule does not match, the request is denied. All `require` rules must match for the request to proceed.
4. If any `allow` rule matches, the request is allowed.
5. If no rule matched the request, the outcome depends on whether any `allow` rules are configured:
   - If no `allow` rules are configured, the request is allowed (denylist semantics: `deny` and `require` rules act as a gate, and anything not blocked is permitted).
   - If `allow` rules are configured, the request is denied (allowlist semantics: only explicitly allowed requests are permitted).

{{< callout type="warning" >}}
A CEL expression that cannot be evaluated is treated as `false`. For example, if the expression refers to `jwt.aud`, but the request has no JWT. The effect depends on the rule type:
- A `require` expression that is `false` (or errors) denies the request (fail-closed).
- A `deny` expression that errors does not match, so it does not deny the request (fail-open).
- An `allow` expression that errors does not match, so it does not allow the request.
{{< /callout >}}

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    authorization:
      rules:
      - allow: 'request.path == "/authz/public"'
      - deny: 'request.path == "/authz/deny"'
      - require: 'jwt.aud == "my-service"'
      # legacy format; same as `allow: ...`
      - 'request.headers["x-allow"] == "true"'
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    authorization:
      rules:
      - allow: 'request.path == "/authz/public"'
      - deny: 'request.path == "/authz/deny"'
      - require: 'jwt.aud == "my-service"'
      # legacy format; same as `allow: ...`
      - 'request.headers["x-allow"] == "true"'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        authorization:
          rules:
          - allow: 'request.path == "/authz/public"'
          - deny: 'request.path == "/authz/deny"'
          - require: 'jwt.aud == "my-service"'
          # legacy format; same as `allow: ...`
          - 'request.headers["x-allow"] == "true"'
      backends:
      - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="http-authz" >}}
# WHAT THIS TEST VALIDATES:
#   * The authorization policy with allow/deny/require and legacy rules is
#     accepted by agentgateway in all three configuration forms: routing-based
#     (binds), simplified LLM (llm.policies), and simplified MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That requests are actually allowed/denied at runtime — requires a backend
#     and traffic the page omits.
#   * The `### Require rules` snippets and the model-layer `llm:` example are
#     focused fragments, so they are not tested.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        authorization:
          rules:
          - allow: 'request.path == "/authz/public"'
          - deny: 'request.path == "/authz/deny"'
          - require: 'jwt.aud == "my-service"'
          # legacy format; same as `allow: ...`
          - 'request.headers["x-allow"] == "true"'
      backends:
      - host: localhost:8080
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    authorization:
      rules:
      - allow: 'request.path == "/authz/public"'
      - deny: 'request.path == "/authz/deny"'
      - require: 'jwt.aud == "my-service"'
      # legacy format; same as `allow: ...`
      - 'request.headers["x-allow"] == "true"'
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config-llm.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    authorization:
      rules:
      - allow: 'request.path == "/authz/public"'
      - deny: 'request.path == "/authz/deny"'
      - require: 'jwt.aud == "my-service"'
      # legacy format; same as `allow: ...`
      - 'request.headers["x-allow"] == "true"'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

### Require rules

The `require` rule type expresses mandatory conditions more clearly than double-negative `deny` rules, and it fails closed. For example:

```yaml
authorization:
  rules:
  - require: 'jwt.aud == "my-service"'
```

You might be tempted to express the same intent with a `deny` rule:

```yaml
# NOT equivalent when jwt.aud is missing
authorization:
  rules:
  - deny: 'jwt.aud != "my-service"'
```

These rules behave the same when a JWT with an audience claim is present, but they differ when the claim is missing. With no JWT, `jwt.aud` is undefined and both expressions error:

- A failed `require` expression denies the request (fail-closed).
- A failed `deny` expression does not match and therefore does not deny the request (fail-open). The request might be allowed by other rules. 

For mandatory conditions such as "all requests must have a valid audience claim," prefer `require`, which fails closed.

Unlike `allow` rules (where any one match permits the request), all `require` rules must match for the request to proceed.

## LLM authorization

In simplified LLM mode, you can also apply authorization at the policy layer with `llm.policies.authorization.rules` to require every request on the local listener to be authenticated, and at the model layer with `llm.models[].authorization.rules` to restrict access to a specific model.

Each rule in `llm.models[].authorization.rules` uses the same schema as route authorization:
- A CEL string (legacy shorthand for `allow`)
- An object with `allow`
- An object with `deny`
- An object with `require`

```yaml
llm:
  models:
  - name: gpt-4
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
    authorization:
      rules:
      - require: 'jwt.aud == "llm-api"'
      - deny: 'request.headers["x-org"] == "blocked"'
      - 'request.headers["x-org"] == "engineering"'
```

The LLM models endpoint (`/v1/models`) is also gated by authorization. If a caller does not satisfy authorization rules for a model, that model is not returned. This authorization filtering is separate from [`llm.models[].visibility`]({{< link-hextra path="/llm/virtual-models/#public-and-internal-models" >}}), which controls whether a model is directly exposed or kept as an internal virtual-model target.
