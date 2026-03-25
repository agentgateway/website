---
title: Generate request tracing headers
weight: 10
description: Use uuid() and random() CEL functions to inject a unique request ID and a random sampling value into request headers.
test:
  tracing:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/transformations/tracing.md
    path: tracing
---

{{< reuse "agw-docs/pages/traffic-management/transformations/tracing.md" >}}
