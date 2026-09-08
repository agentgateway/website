---
title: Dynamic Forward Proxy (DFP)
weight: 10
description: Route traffic dynamically to upstream servers based on request characteristics.
test:
  dfp:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/dfp.md
    path: dfp
---

{{< reuse "agw-docs/pages/traffic-management/dfp.md" >}}