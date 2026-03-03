---
title: Request retries
weight: 10
description: Set up retries for requests.
test:
  retry-in-httproute:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/resiliency/retry/retry.md
    path: retry-in-httproute
---

{{< reuse "agw-docs/pages/resiliency/retry/retry.md" >}}
