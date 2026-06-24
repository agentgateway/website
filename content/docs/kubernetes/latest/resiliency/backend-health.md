---
title: Backend health
weight: 15
description: Automatically evict and restore unhealthy backend endpoints with passive health checking.
test:
  backend-health:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/backend-health.md
    path: backend-health
---

{{< reuse "agw-docs/pages/resiliency/backend-health.md" >}}
