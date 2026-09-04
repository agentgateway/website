---
title: Backend timeouts
weight: 15
description: Set connection and response deadlines for a Kubernetes Service or other destination backend.
test:
  backend-timeouts:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/resiliency/timeouts/backend.md
    path: backend-timeouts
---

{{< reuse "agw-docs/pages/resiliency/timeouts/backend.md" >}}
