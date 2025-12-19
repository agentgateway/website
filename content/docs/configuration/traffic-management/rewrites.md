---
title: Rewrites
weight: 13
---

Rewrites allow modifying URLs of incoming requests.

For example, the following configuration will modify the request hostname to `example.com` and the request path to `/new-path`.

```yaml
urlRewrite:
  authority:
    full: example.com
  path:
    full: /new-path
```

**[Supported attachment points](/docs/configuration/policies/):** Route.