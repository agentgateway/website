---
title: Keepalive
weight: 10
description: Manage idle and stale connections with TCP and HTTP keepalive.
test:
  tcp-keepalive:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/resiliency/keepalive.md
    path: tcp-keepalive

  http-keepalive:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/resiliency/keepalive.md
    path: http-keepalive
---

{{< reuse "agw-docs/pages/resiliency/keepalive.md" >}}
