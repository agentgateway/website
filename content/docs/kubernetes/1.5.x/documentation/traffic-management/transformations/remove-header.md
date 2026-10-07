---
title: Remove headers
weight: 50
description: Remove sensitive or internal headers from requests before they reach the upstream.
test:
  remove-header:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/transformations/remove-header.md
    path: remove-header
---

{{< reuse "agw-docs/pages/traffic-management/transformations/remove-header.md" >}}
