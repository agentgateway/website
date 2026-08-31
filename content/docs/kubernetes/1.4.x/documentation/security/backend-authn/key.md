---
title: Static keys and passthrough
weight: 10
description: Send a static credential to a backend, forward the credential that the client sent, or add extra credentials to the request.
test:
  backend-authn-key:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/security/backend-authn/key.md
    path: backend-authn-key
---

{{< reuse "agw-docs/pages/security/backend-authn-key.md" >}}
