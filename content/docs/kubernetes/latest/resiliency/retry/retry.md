---
title: Request retries
weight: 10
description: Set up retries for requests.
test:
  retry-in-httproute:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: retry-in-httproute
  retry-in-agentgateway:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: retry-in-agentgateway
  retry-in-gatewaylistener:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: retry-in-gatewaylistener
---

{{< reuse "agw-docs/pages/resiliency/retry/retry.md" >}}
