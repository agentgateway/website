---
title: Direct responses
weight: 10
description: Return responses directly without forwarding to upstream services.
test:
  direct-response:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/direct-response.md
    path: direct-response
---

{{< reuse "agw-docs/pages/traffic-management/direct-response.md" >}}
