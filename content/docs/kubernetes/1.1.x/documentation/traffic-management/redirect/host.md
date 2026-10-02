---
title: Host redirect
weight: 442
description: Redirect requests to a different host.
test:
  host-redirect:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/redirect/host.md
    path: host-redirect
---

{{< reuse "agw-docs/pages/traffic-management/redirect/host.md" >}}

