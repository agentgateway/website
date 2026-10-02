---
title: Host redirect
weight: 442
description: Redirect requests to a different host.
test:
  host-redirect:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/redirect/host.md
    path: host-redirect
---

{{< reuse "agw-docs/pages/traffic-management/redirect/host.md" >}}

