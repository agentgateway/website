---
title: Validate and set request body defaults
weight: 70
description: Use default() and fail() CEL functions to enforce required fields and apply default values on a JSON request body.
test:
  validate-defaults:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/transformations/validate.md
    path: validate-defaults
  validate-skip:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/transformations/validate.md
    path: validate-skip
---

{{< reuse "agw-docs/pages/traffic-management/transformations/validate.md" >}}
