---
title: Per-try timeout
weight: 20
description: Set up per-try timeouts.
test:
  per-try-timeout-in-httproute:
  - file: content/docs/kubernetes/main/install/helm.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/resiliency/retry/per-try-timeout.md
    path: per-try-timeout-in-httproute
---

{{< reuse "agw-docs/pages/resiliency/retry/per-try-timeout.md" >}}
