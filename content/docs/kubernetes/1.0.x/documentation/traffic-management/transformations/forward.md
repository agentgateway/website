---
title: Create redirect URLs
weight: 40
description: Use CEL expressions to construct a redirect URL from context variables and forward it upstream as a request header.
test:
  forward:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/traffic-management/transformations/forward.md
    path: forward
---

{{< reuse "agw-docs/pages/traffic-management/transformations/forward.md" >}}
