---
title: Change response bodies
weight: 60
description: Update the response status based on the headers in a response.
test:
  change-response-status:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/transformations/status.md
    path: change-response-status
---

{{< reuse "agw-docs/pages/traffic-management/transformations/status.md" >}}
