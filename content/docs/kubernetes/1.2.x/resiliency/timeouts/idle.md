---
title: Idle timeouts
weight: 20
description: Set idle timeouts to terminate inactive HTTP/1 connections.
test:
  idle-timeout:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/timeouts/idle.md
    path: idle-timeout
---

{{< reuse "agw-docs/pages/resiliency/timeouts/idle.md" >}}
