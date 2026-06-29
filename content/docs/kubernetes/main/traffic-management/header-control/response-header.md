---
title: Response headers
weight: 20
description: Add, set, or remove response headers.
test:
  add-response-header:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/traffic-management/header-control/response-header.md
    path: add-response-header
  set-response-header:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/traffic-management/header-control/response-header.md
    path: set-response-header
  remove-response-header:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/traffic-management/header-control/response-header.md
    path: remove-response-header
---

{{< reuse "agw-docs/pages/traffic-management/header-control/response-header.md" >}}
