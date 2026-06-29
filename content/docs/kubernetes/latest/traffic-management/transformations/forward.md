---
title: Forward request URLs
weight: 40
description: Use CEL expressions to construct a full request URL from context variables and forward it upstream as a request header.
test:
  forward:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: forward
---

{{< reuse "agw-docs/pages/traffic-management/transformations/forward.md" >}}
