---
title: CORS
weight: 10
---

Cross-origin resource sharing ([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)) is a browser security mechanism which allows a server to control which origins can request resources.

> [!TIP]
> CORS is enforced on the browser, not the server. Request that violate the CORS policy will still have responses returned, but the browser will reject them. As such, usage of tools like `curl` with `cors` can be confusing, as `curl` does not respect CORS headers.

Example:

```yaml
cors:
  allowOrigins:
  - "*"
  allowHeaders:
  - mcp-protocol-version
  - content-type
  allowCredentials: true
  exposeHeaders:
  - x-my-header
  maxAge: 100s
```