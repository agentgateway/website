---
title: Extract query parameters
weight: 45
description: Extract query parameters by using pseudo headers to change the request path and HTTP method when a request header is present.
test:
  query:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/traffic-management/transformations/query.md
    path: query
---

{{< reuse "agw-docs/pages/traffic-management/transformations/query.md" >}}
