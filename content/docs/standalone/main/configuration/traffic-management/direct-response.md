---
title: Direct Response
weight: 14
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

Directly respond to a request with a custom response using {{< gloss "Direct Response" >}}direct response{{< /gloss >}}, without forwarding to any backend.


For example, the following configuration returns a `404 Not found!` response.

```yaml
directResponse:
  body: "Not found!"
  status: 404
```

## Conditional execution

To return a direct response only when a CEL expression matches, use the `conditional` field. For example, you can return `410 Gone` on deprecated paths and let every other request reach the backend. For details, see [Conditional policies]({{< link-hextra path="/configuration/conditional-policies" >}}).
