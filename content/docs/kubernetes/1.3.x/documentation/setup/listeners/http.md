---
title: HTTP
weight: 10
description: Create an HTTP listener on your gateway proxy to serve HTTPRoutes.
test:
  http-listener:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/setup/listeners/http.md
    path: http-listener
---

{{< reuse "agw-docs/pages/setup/listeners/http.md" >}}
