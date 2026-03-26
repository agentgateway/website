---
title: Change request path and method
weight: 45
description: Use pseudo headers to conditionally rewrite the request path and HTTP method based on a request header value.
test:
  path-method:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/traffic-management/transformations/path-method.md
    path: path-method
---

{{< reuse "agw-docs/pages/traffic-management/transformations/path-method.md" >}}
