---
title: Forward request URLs
weight: 40
description: Use CEL expressions to construct a full request URL from context variables and forward it upstream as a request header.
test:
  forward:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/transformations/forward.md
    path: forward
---

{{< reuse "agw-docs/pages/traffic-management/transformations/forward.md" >}}
