---
title: Rewrite dynamic path segments
weight: 30
description: Use CEL functions to rewrite request paths in a header.
test:
  rewrite:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/traffic-management/transformations/rewrite.md
    path: rewrite
---

{{< reuse "agw-docs/pages/traffic-management/transformations/rewrite.md" >}}
