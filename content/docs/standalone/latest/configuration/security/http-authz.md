---
title: HTTP authorization
weight: 12
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

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
A CEL expression that cannot be evaluated — for example, referencing `jwt.aud` when the request has no JWT — is treated as `false`. The effect depends on the rule type:
- A `require` expression that is `false` (or errors) denies the request (fail-closed).
- A `deny` expression that errors does not match, so it does not deny the request (fail-open).
- An `allow` expression that errors does not match, so it does not allow the request.
{{< /callout >}}

```yaml
authorization:
  rules:
  - allow: 'request.path == "/authz/public"'
  - deny: 'request.path == "/authz/deny"'
  - require: 'jwt.aud == "my-service"'
  # legacy format; same as `allow: ...`
  - 'request.headers["x-allow"] == "true"'
```

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

These behave the same when a JWT with an audience claim is present, but they differ when the claim is missing. With no JWT, `jwt.aud` is undefined and both expressions error. A failed `require` expression denies the request (fail-closed), but a failed `deny` expression does not match and therefore does not deny the request (fail-open) — the request may be allowed by other rules. For mandatory conditions such as "all requests must have a valid audience claim," prefer `require`, which fails closed.

Unlike `allow` rules (where any one match permits the request), all `require` rules must match for the request to proceed.