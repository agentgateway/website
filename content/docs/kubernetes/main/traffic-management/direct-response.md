---
title: Direct responses
weight: 10
description: Return responses directly without forwarding to upstream services.
test:
  direct-response:
    type: [schema, functional]
    steps:
    - file: ${versionRoot}/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/setup/gateway.md
      path: all
    - file: ${versionRoot}/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/traffic-management/direct-response.md
      path: direct-response
---

{{< reuse "agw-docs/pages/traffic-management/direct-response.md" >}}
