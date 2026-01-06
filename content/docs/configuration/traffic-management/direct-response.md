---
title: Direct Response
weight: 14
---

Direct Response allows you to directly respond to a request with a custom response, without forwarding to any backend.


For example, the following configuration will modify the request hostname to `example.com` and the request path to `/new-path`.

```yaml
directResponse:
  body: "Not found!"
  status: 404
```

**[Supported attachment points](/docs/configuration/policies/):** Route.
