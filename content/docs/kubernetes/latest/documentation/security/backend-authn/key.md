---
title: Static keys and passthrough
weight: 10
description: Send a static credential to a backend, forward the credential that the client sent, or add extra credentials to the request.
test:
  backend-authn-key:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/security/backend-authn/key.md
    path: backend-authn-key
---

{{< reuse "agw-docs/pages/security/backend-authn-key.md" >}}
