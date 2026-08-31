---
title: Dynamic Forward Proxy (DFP)
weight: 10
description: Route traffic dynamically to upstream servers based on request characteristics.
test:
  dfp:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/dfp.md
    path: dfp
---

{{< reuse "agw-docs/pages/traffic-management/dfp.md" >}}