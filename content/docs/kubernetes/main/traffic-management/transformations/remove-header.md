---
title: Remove headers
weight: 50
description: Remove sensitive or internal headers from requests before they reach the upstream.
test:
  remove-header:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: remove-header
---

{{< reuse "agw-docs/pages/traffic-management/transformations/remove-header.md" >}}
