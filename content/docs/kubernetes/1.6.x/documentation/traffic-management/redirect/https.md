---
title: HTTPS redirect
weight: 441
description: Redirect HTTP traffic to HTTPS.
test:
  https-redirect:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/redirect/https.md
    path: https-redirect
---

{{< reuse "agw-docs/pages/traffic-management/redirect/https.md" >}}