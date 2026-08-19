---
title: CORS
description: Configure cross-origin resource sharing policies for cross-origin requests.
weight: 10
test:
  cors-in-httproute:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/security/cors.md
    path: cors-in-httproute

  cors-in-agentgatewaypolicy:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/security/cors.md
    path: cors-in-agentgatewaypolicy
---

{{< reuse "agw-docs/pages/security/cors.md" >}}

