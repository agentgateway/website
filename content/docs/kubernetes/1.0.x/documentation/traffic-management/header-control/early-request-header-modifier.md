---
title: Early request header modification
weight: 30
test:
  remove-reserved-header:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/header-control/early-request-header-modifier.md
    path: remove-reserved-header
---

{{< reuse "agw-docs/pages/traffic-management/header-control/early-request-header-modifier.md" >}}

