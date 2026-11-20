---
title: Per-try timeout
weight: 20
description: Set up per-try timeouts.
test:
  per-try-timeout-in-httproute:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/resiliency/retry/per-try-timeout.md
    path: per-try-timeout-in-httproute
  per-try-timeout-in-agentgateway:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/resiliency/retry/per-try-timeout.md
    path: per-try-timeout-in-agentgateway
  per-try-timeout-in-gatewaylistener:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/resiliency/retry/per-try-timeout.md
    path: per-try-timeout-in-gatewaylistener
---

{{< reuse "agw-docs/pages/resiliency/retry/per-try-timeout.md" >}}
