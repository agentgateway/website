---
title: Request timeouts
weight: 10
description: Configure timeouts for all routes in an HTTPRoute.
test:
  timeout-in-httproute:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/resiliency/timeouts/request.md
    path: timeout-in-httproute
  timeout-in-trafficpolicy:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/resiliency/timeouts/request.md
    path: timeout-in-trafficpolicy
  timeout-in-gatewaylistener:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/resiliency/timeouts/request.md
    path: timeout-in-gatewaylistener
---

{{< reuse "agw-docs/pages/resiliency/timeouts/request.md" >}}
