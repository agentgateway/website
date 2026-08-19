---
title: BackendTLS
weight: 10
description: Originate one-way TLS connections from the Gateway to backend services.
test:
  backendtls-secret-ca:
    type: [schema, functional]
    steps:
    - file: ${versionRoot}/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/setup/gateway.md
      path: all
    - path: backendtls-secret-ca
---

{{< reuse "agw-docs/pages/security/backendtls.md" >}}