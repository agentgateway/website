---
title: Direct Response
weight: 14
---

Attach to:
{{< badge content="Route" link="/docs/configuration/routes/">}}

Directly respond to a request with a custom response, without forwarding to any backend.


For example, the following configuration returns a `404 Not found!` response.

```yaml
directResponse:
  body: "Not found!"
  status: 404
```
