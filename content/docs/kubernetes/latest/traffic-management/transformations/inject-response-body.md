---
title: Inject response bodies
weight: 55
description: Learn how to return a customized response body and how to replace specific values in the body.
test:
  inject-header-into-body:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: inject-header-into-body
  inject-body-field-into-body:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: inject-body-field-into-body
---

{{< reuse "agw-docs/pages/traffic-management/transformations/inject-response-body.md" >}}
