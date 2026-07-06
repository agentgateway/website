---
title: Idle timeouts
weight: 20
description: Set idle timeouts to terminate inactive HTTP/1 connections.
test:
  idle-timeout:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/resiliency/timeouts/idle.md
    path: idle-timeout
---

{{< reuse "agw-docs/pages/resiliency/timeouts/idle.md" >}}
