---
title: HTTP authorization
weight: 12
---

Attach to:
{{< badge content="Route" path="/configuration/routes/">}}

HTTP {{< gloss "Authorization (AuthZ)" >}}authorization{{< /gloss >}} allows defining rules to allow or deny requests based on their properties, using [CEL expressions]({{< link-hextra path="/reference/cel/" >}}).

{{< callout type="info" >}}
Try out CEL expressions in the built-in [CEL playground]({{< link-hextra path="/reference/cel/" >}}#cel-playground) in the agentgateway admin UI before using them in your configuration.
{{< /callout >}}

Policies can define `allow`, `deny`, and `require` rules. When evaluating a request:
1. If there are no policies, the request is allowed.
2. If any `deny` policy matches, the request is denied.
3. All `require` policies must match. If any `require` policy does not match, the request is denied.
4. If any `allow` policy matches, the request is allowed.
5. If only `deny` rules exist (no `allow` rules), unmatched requests are allowed (denylist semantics).
6. If `allow` rules exist but none matched, the request is denied (allowlist semantics).

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

The `require` rule type provides clearer semantics than double-negative deny rules for expressing mandatory conditions. For example, the following two configurations are equivalent, but `require` is easier to read:

```yaml
# Using require (recommended)
authorization:
  rules:
  - require: 'jwt.aud == "my-service"'

# Equivalent using deny (less clear)
authorization:
  rules:
  - deny: 'jwt.aud != "my-service"'
```

Unlike `allow` rules, all `require` rules must match for the request to proceed. Use `require` rules to express invariants like "all requests must have a valid audience claim."