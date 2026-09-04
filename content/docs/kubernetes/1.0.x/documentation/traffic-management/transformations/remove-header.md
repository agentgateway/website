---
title: Remove headers
weight: 50
description: Remove sensitive or internal headers from requests before they reach the upstream.
test:
  remove-header:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/transformations/remove-header.md
    path: remove-header
---

{{< reuse "agw-docs/pages/traffic-management/transformations/remove-header.md" >}}
