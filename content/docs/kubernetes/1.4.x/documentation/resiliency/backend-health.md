---
title: Backend health
weight: 15
description: Automatically evict and restore unhealthy backend endpoints with passive health checking.
test:
  backend-health:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/resiliency/backend-health.md
    path: backend-health
---

{{< reuse "agw-docs/pages/resiliency/backend-health.md" >}}
