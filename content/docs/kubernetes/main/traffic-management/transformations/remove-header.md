---
title: Remove headers
weight: 50
description: Remove sensitive or internal headers from requests before they reach the upstream.
test:
  remove-header:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/transformations/remove-header.md
    path: remove-header
---

{{< reuse "agw-docs/pages/traffic-management/transformations/remove-header.md" >}}
