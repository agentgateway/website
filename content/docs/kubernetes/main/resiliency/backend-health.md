---
title: Backend health
weight: 15
description: Automatically evict and restore unhealthy backend endpoints with passive health checking.
test:
  backend-health:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: backend-health
---

{{< reuse "agw-docs/pages/resiliency/backend-health.md" >}}
