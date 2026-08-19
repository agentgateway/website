---
title: Dynamic Forward Proxy (DFP)
weight: 10
description: Route traffic dynamically to upstream servers based on request characteristics.
test:
  dfp:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/traffic-management/dfp.md
    path: dfp
---

{{< reuse "agw-docs/pages/traffic-management/dfp.md" >}}