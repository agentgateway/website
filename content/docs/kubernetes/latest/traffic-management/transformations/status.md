---
title: Change response bodies
weight: 60
description: Update the response status based on the headers in a response.
test:
  change-response-status:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/transformations/status.md
    path: change-response-status
---

{{< reuse "agw-docs/pages/traffic-management/transformations/status.md" >}}
