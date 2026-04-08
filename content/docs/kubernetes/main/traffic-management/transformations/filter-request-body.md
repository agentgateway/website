---
title: Filter and merge request body fields
weight: 60
description: Use filterKeys() and merge() CEL functions to strip unwanted fields from a JSON request body and inject defaults before forwarding to the upstream.
test:
  filter-request-body:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/transformations/filter-request-body.md
    path: filter-request-body
---

{{< reuse "agw-docs/pages/traffic-management/transformations/filter-request-body.md" >}}
