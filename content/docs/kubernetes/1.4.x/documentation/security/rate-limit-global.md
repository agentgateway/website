---
title: Global rate limiting
weight: 45
description: Apply distributed rate limits across multiple agentgateway replicas using an external rate limit service.
test:
  global-rate-limit-by-ip:
  - file: ${versionRoot}/documentation/install/helm.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/security/rate-limit-global.md
    path: global-rate-limit-by-ip
---

{{< reuse "agw-docs/pages/security/rate-limit-global.md" >}}
