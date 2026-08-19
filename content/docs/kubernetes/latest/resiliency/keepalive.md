---
title: Keepalive
weight: 10
description: Manage idle and stale connections with TCP and HTTP keepalive.
test:
  tcp-keepalive:
    type: [schema, functional]
    steps:
    - file: ${versionRoot}/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/setup/gateway.md
      path: all
    - file: ${versionRoot}/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/resiliency/keepalive.md
      path: tcp-keepalive

  http-keepalive:
    type: [schema, functional]
    steps:
    - file: ${versionRoot}/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/setup/gateway.md
      path: all
    - file: ${versionRoot}/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/resiliency/keepalive.md
      path: http-keepalive
---

{{< reuse "agw-docs/pages/resiliency/keepalive.md" >}}
