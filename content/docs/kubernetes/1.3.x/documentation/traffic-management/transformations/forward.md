---
title: Forward request URLs
weight: 40
description: Use CEL expressions to construct a full request URL from context variables and forward it upstream as a request header.
test:
  forward:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/transformations/forward.md
    path: forward
---

{{< reuse "agw-docs/pages/traffic-management/transformations/forward.md" >}}
