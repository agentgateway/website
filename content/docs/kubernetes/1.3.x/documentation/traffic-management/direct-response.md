---
title: Direct responses
weight: 10
description: Return responses directly without forwarding to upstream services.
test:
  direct-response:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/direct-response.md
    path: direct-response
---

{{< reuse "agw-docs/pages/traffic-management/direct-response.md" >}}
