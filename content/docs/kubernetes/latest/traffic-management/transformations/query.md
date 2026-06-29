---
title: Promote query parameters to request headers
weight: 46
description: Read a query parameter from the request URI and inject it as a request header using a CEL conditional expression.
test:
  query:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/traffic-management/transformations/query.md
    path: query
---

{{< reuse "agw-docs/pages/traffic-management/transformations/query.md" >}}
