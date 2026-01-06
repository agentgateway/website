---
title: Rewrites
weight: 13
---

Attach to:
{{< badge content="Route" link="/docs/configuration/routes/">}}

Modify URLs of incoming requests with rewrite policies.

For example, the following configuration modifies the request hostname to `example.com` and the request path to `/new-path`.

```yaml
urlRewrite:
  authority:
    full: example.com
  path:
    full: /new-path
```