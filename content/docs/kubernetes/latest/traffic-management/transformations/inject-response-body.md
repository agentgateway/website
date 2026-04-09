---
title: Inject response bodies
weight: 55
description: Learn how to return a customized response body and how to replace specific values in the body.
test:
  inject-header-into-body:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/transformations/inject-response-body.md
    path: inject-header-into-body
  inject-body-field-into-body:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/transformations/inject-response-body.md
    path: inject-body-field-into-body
---

{{< reuse "agw-docs/pages/traffic-management/transformations/inject-response-body.md" >}}
