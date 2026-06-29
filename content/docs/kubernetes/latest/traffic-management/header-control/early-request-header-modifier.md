---
title: Early request header modification
weight: 30
description: Modify request headers in the early phase of request processing.
test:
  remove-reserved-header:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: remove-reserved-header
---

{{< reuse "agw-docs/pages/traffic-management/header-control/early-request-header-modifier.md" >}}

