---
title: HTTPS redirect
weight: 441
description: Redirect HTTP traffic to HTTPS.
test:
  https-redirect:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/traffic-management/redirect/https.md
    path: https-redirect
---

{{< reuse "agw-docs/pages/traffic-management/redirect/https.md" >}}