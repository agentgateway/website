---
title: HTTP
weight: 10
description: Create an HTTP listener on your gateway proxy to serve HTTPRoutes.
test:
  http-listener:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: http-listener
---

{{< reuse "agw-docs/pages/setup/listeners/http.md" >}}
