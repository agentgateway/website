---
title: Keepalive
weight: 10
description: Manage idle and stale connections with TCP and HTTP keepalive.
test:
  tcp-keepalive:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/keepalive.md
    path: tcp-keepalive

  http-keepalive:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/keepalive.md
    path: http-keepalive
---

{{< reuse "agw-docs/pages/resiliency/keepalive.md" >}}
