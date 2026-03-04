---
title: CORS
weight: 10
description:
test:
  cors-in-httproute:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/security/cors.md
    path: cors-in-httproute

  cors-in-agentgatewaypolicy:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/security/cors.md
    path: cors-in-agentgatewaypolicy
---

{{< reuse "agw-docs/pages/security/cors.md" >}}