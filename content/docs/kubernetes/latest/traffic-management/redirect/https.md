---
title: HTTPS redirect
weight: 441
description: Redirect HTTP traffic to HTTPS.
test:
  https-redirect:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: https-redirect
---

{{< reuse "agw-docs/pages/traffic-management/redirect/https.md" >}}