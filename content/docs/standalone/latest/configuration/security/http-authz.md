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

Policies can define `allow` and `deny` rules. When evaluating a request:
1. If there are no policies, the request is allowed.
2. If any `deny` policy matches, the request is denied.
3. If any `allow` policy matches, the request is allow.
4. Otherwise, the request is denied.

```yaml
authorization:
  rules:
  - allow: 'request.path == "/authz/public"'
  - deny: 'request.path == "/authz/deny"'
  # legacy format; same as `allow: ...`
  - 'request.headers["x-allow"] == "true"'
```