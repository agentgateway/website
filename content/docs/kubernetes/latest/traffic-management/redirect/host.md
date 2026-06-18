---
title: Host redirect
weight: 442
description: Redirect requests to a different host.
test:
  host-redirect:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/redirect/host.md
    path: host-redirect
---

{{< reuse "agw-docs/pages/traffic-management/redirect/host.md" >}}

