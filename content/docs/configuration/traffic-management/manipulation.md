---
title: Header manipulation
weight: 10
---

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

More advanced operations are available with the `transformation` policy.
Like the `HeaderModifier` policies, this can also `add`, `set`, or `remove` headers, but can also manipulate HTTP bodies.
Additionally, each modification is based on a [CEL expression](/docs/operations/cel) rather than static strings.

Examples:

```yaml
transformations:
  request:
    add:
      x-request-id: 'random()'
  response:
    add:
      x-sub: "jwt.sub"
      x-claim: "jwt.nested.key"
    body: |
      has(jwt.sub) ?
      {"success": "user is authenticated as " + jwt.sub} :
      {"error": "unauthenticated"}
```

To modify the request authority (also known as "hostname") or path, the `urlRewrite` policy be used:

```yaml
urlRewrite:
  authority:
    full: example.com
  path:
    full: "/v1/chat/completions"
```