---
title: Rewrite dynamic path segments
weight: 30
description: Use CEL functions to rewrite request paths in a header.
test:
  rewrite:
    type: functional
    steps:
    - file: ${versionRoot}/documentation/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/documentation/setup/gateway.md
      path: all
    - file: ${versionRoot}/documentation/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/documentation/traffic-management/transformations/rewrite.md
      path: rewrite
      assert:
      - products/agentgateway/main/traffic-management/transformations/rewrite.sh
---

{{< reuse "agw-docs/pages/traffic-management/transformations/rewrite.md" >}}
