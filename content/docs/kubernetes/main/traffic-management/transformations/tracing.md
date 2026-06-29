---
title: Generate request tracing headers
weight: 10
description: Use uuid() and random() CEL functions to inject a unique request ID and a random sampling value into request headers.
test:
  tracing:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: tracing
---

{{< reuse "agw-docs/pages/traffic-management/transformations/tracing.md" >}}
