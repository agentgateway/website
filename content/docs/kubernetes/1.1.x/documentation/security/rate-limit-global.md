---
title: Global rate limiting
weight: 45
description: Apply distributed rate limits across multiple agentgateway replicas using an external rate limit service.
test:
  global-rate-limit-by-ip:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/security/rate-limit-global.md
    path: global-rate-limit-by-ip
---

{{< reuse "agw-docs/pages/security/rate-limit-global.md" >}}
