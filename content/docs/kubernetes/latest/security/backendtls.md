---
title: BackendTLS
weight: 10
description: Originate one-way TLS connections from the Gateway to backend services.
test:
  backendtls-in-cluster:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/security/backendtls.md
    path: backendtls-in-cluster

  backendtls-external:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/security/backendtls.md
    path: backendtls-external
---

{{< reuse "agw-docs/pages/security/backendtls.md" >}}