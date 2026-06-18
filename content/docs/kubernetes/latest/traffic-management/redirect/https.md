---
title: HTTPS redirect
weight: 441
description: Redirect HTTP traffic to HTTPS.
test:
  https-redirect:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/redirect/https.md
    path: https-redirect
---

{{< reuse "agw-docs/pages/traffic-management/redirect/https.md" >}}