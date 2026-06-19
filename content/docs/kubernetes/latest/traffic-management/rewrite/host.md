---
title: Host rewrites
weight: 461
description: Replace the host header value before forwarding a request to a backend service.
test:
  host-rewrite:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/rewrite/host.md
    path: host-rewrite
---

{{< reuse "agw-docs/pages/traffic-management/rewrite/host.md" >}}
