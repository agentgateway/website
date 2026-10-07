---
title: CORS
description: Configure cross-origin resource sharing policies for cross-origin requests.
weight: 10
test:
  cors-in-httproute:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/security/cors.md
    path: cors-in-httproute

  cors-in-agentgatewaypolicy:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/security/cors.md
    path: cors-in-agentgatewaypolicy
---

{{< reuse "agw-docs/pages/security/cors.md" >}}

