---
title: Per-try timeout
weight: 20
description: Set up per-try timeouts.
test:
  per-try-timeout-in-httproute:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/resiliency/retry/per-try-timeout.md
    path: per-try-timeout-in-httproute
  per-try-timeout-in-agentgateway:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/resiliency/retry/per-try-timeout.md
    path: per-try-timeout-in-agentgateway
  per-try-timeout-in-gatewaylistener:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/resiliency/retry/per-try-timeout.md
    path: per-try-timeout-in-gatewaylistener
---

{{< reuse "agw-docs/pages/resiliency/retry/per-try-timeout.md" >}}
