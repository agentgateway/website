---
title: Request timeouts
weight: 10
description: Configure timeouts for all routes in an HTTPRoute.
test:
  timeout-in-httproute:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/timeouts/request.md
    path: timeout-in-httproute
  timeout-in-trafficpolicy:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/timeouts/request.md
    path: timeout-in-trafficpolicy
  timeout-in-gatewaylistener:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/timeouts/request.md
    path: timeout-in-gatewaylistener
---

{{< reuse "agw-docs/pages/resiliency/timeouts/request.md" >}}
