---
title: Rewrite dynamic path segments
weight: 30
description: Use CEL functions to rewrite request paths in a header.
test:
  rewrite:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/transformations/rewrite.md
    path: rewrite
---

{{< reuse "agw-docs/pages/traffic-management/transformations/rewrite.md" >}}
