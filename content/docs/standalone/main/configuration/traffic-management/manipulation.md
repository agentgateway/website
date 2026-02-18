---
title: Header manipulation
weight: 10
---

Attach to:
{{< badge content="Route" link="/docs/configuration/routes/">}} {{< badge content="Backend" link="/docs/configuration/backends/">}}

There are a few different policies that offer manipulation of HTTP requests and responses.

The `requestHeaderModifier` and `responseHeaderModifier` modify request and response headers respectively.
These allow you to `add`, `set`, or `remove` headers.
`add` and `set` differ in the case the header already exists; `set` will replace it while `add` will append.

```yaml
requestHeaderModifier:
  add:
    x-req-added: value
  remove:
    - x-remove-me
```

More advanced operations are available with the [`transformation` policy](../transformations).
Like the `HeaderModifier` policies, this can also `add`, `set`, or `remove` headers, but can also manipulate HTTP bodies.
Additionally, each modification is based on a [CEL expression]({{< link-hextra path="/configuration/traffic-management/transformations" >}}) rather than static strings.