---
title: HTTP connection settings
weight: 10
description: Configure and manage HTTP connections to an upstream service.
test:
  connection-general:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/resiliency/connection.md
    path: connection-general

  connection-http1:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/resiliency/connection.md
    path: connection-http1

  connection-http2-flow:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/resiliency/connection.md
    path: connection-http2-flow
---

{{< reuse "agw-docs/pages/resiliency/connection.md" >}}
