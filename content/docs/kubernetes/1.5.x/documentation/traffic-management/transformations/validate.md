---
title: Validate and set request body defaults
weight: 70
description: Use default() and fail() CEL functions to enforce required fields and apply default values on a JSON request body.
test:
  validate-defaults:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/transformations/validate.md
    path: validate-defaults
  validate-skip:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/transformations/validate.md
    path: validate-skip
---

{{< reuse "agw-docs/pages/traffic-management/transformations/validate.md" >}}
