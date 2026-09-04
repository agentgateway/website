---
title: Promote query parameters to request headers
weight: 46
description: Read a query parameter from the request URI and inject it as a request header using a CEL conditional expression.
test:
  query:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/transformations/query.md
    path: query
---

{{< reuse "agw-docs/pages/traffic-management/transformations/query.md" >}}
