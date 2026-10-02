---
title: Request retries
weight: 10
description: Set up retries for requests.
test:
  retry-in-httproute:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/resiliency/retry/retry.md
    path: retry-in-httproute
  retry-in-agentgateway:
    type: [schema, functional]
    steps:
    - file: ${versionRoot}/documentation/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/documentation/setup/gateway.md
      path: all
    - file: ${versionRoot}/documentation/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/documentation/resiliency/retry/retry.md
      path: retry-in-agentgateway
  retry-in-gatewaylistener:
    type: [schema, functional]
    steps:
    - file: ${versionRoot}/documentation/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/documentation/setup/gateway.md
      path: all
    - file: ${versionRoot}/documentation/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/documentation/resiliency/retry/retry.md
      path: retry-in-gatewaylistener
---

{{< reuse "agw-docs/pages/resiliency/retry/retry.md" >}}
