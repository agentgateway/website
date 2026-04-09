---
title: Early request header modification
weight: 30
test:
  remove-reserved-header:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/header-control/early-request-header-modifier.md
    path: remove-reserved-header
---

{{< reuse "agw-docs/pages/traffic-management/header-control/early-request-header-modifier.md" >}}

