---
title: Keepalive
weight: 10
description: Manage idle and stale connections with TCP and HTTP keepalive.
test:
  tcp-keepalive:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: tcp-keepalive

  http-keepalive:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: http-keepalive
---

{{< reuse "agw-docs/pages/resiliency/keepalive.md" >}}
