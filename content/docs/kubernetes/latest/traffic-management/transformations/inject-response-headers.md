---
title: Inject response headers
weight: 5
description: Extract values from a request header and inject it as a header to your response.
test:
  inject-response-headers:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: inject-response-headers
---

{{< reuse "agw-docs/pages/traffic-management/transformations/inject-response-headers.md" >}}
