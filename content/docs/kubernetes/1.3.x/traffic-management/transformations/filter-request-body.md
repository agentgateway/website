---
title: Filter and merge request body fields
weight: 60
description: Use filterKeys() and merge() CEL functions to strip unwanted fields from a JSON request body and inject defaults before forwarding to the upstream.
test:
  filter-request-body:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/traffic-management/transformations/filter-request-body.md
    path: filter-request-body
---

{{< reuse "agw-docs/pages/traffic-management/transformations/filter-request-body.md" >}}
