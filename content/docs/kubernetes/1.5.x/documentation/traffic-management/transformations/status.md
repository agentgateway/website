---
title: Change response bodies
weight: 60
description: Update the response status based on the headers in a response.
test:
  change-response-status:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/transformations/status.md
    path: change-response-status
---

{{< reuse "agw-docs/pages/traffic-management/transformations/status.md" >}}
