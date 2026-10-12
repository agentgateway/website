---
title: Fault injection
weight: 20
description: Inject artificial latency into requests to test how your clients and services handle slow responses.
test:
  delay-in-trafficpolicy:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - path: delay-in-trafficpolicy
---

{{< reuse "agw-docs/pages/resiliency/fault-injection.md" >}}
