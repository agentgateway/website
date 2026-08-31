---
title: Remove headers
weight: 50
description: Remove sensitive or internal headers from requests before they reach the upstream.
test:
  remove-header:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/traffic-management/transformations/remove-header.md
    path: remove-header
---

{{< reuse "agw-docs/pages/traffic-management/transformations/remove-header.md" >}}
