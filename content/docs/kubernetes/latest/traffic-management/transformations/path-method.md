---
title: Change request path and method
weight: 45
description: Use pseudo headers to conditionally rewrite the request path and HTTP method based on a request header value.
test:
  path-method:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: path-method
---

{{< reuse "agw-docs/pages/traffic-management/transformations/path-method.md" >}}
