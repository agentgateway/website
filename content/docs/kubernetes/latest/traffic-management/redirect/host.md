---
title: Host redirect
weight: 442
description: Redirect requests to a different host.
test:
  host-redirect:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: host-redirect
---

{{< reuse "agw-docs/pages/traffic-management/redirect/host.md" >}}

