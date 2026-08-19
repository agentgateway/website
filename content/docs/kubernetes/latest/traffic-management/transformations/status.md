---
title: Change response bodies
weight: 60
description: Update the response status based on the headers in a response.
test:
  change-response-status:
    type: functional
    steps:
    - file: ${versionRoot}/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/setup/gateway.md
      path: all
    - file: ${versionRoot}/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/traffic-management/transformations/status.md
      path: change-response-status
      assert:
      - products/agentgateway/main/traffic-management/transformations/status.sh
  change-response-status-schema:
    type: schema
    steps:
    - file: ${versionRoot}/traffic-management/transformations/status.md
      path: change-response-status
---

{{< reuse "agw-docs/pages/traffic-management/transformations/status.md" >}}
