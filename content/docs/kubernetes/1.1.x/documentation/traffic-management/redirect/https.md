---
title: HTTPS redirect
weight: 441
description: Redirect HTTP traffic to HTTPS.
test:
  https-redirect:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/redirect/https.md
    path: https-redirect
---

{{< reuse "agw-docs/pages/traffic-management/redirect/https.md" >}}