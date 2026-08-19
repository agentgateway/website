---
title: Signed JWT (jwtSign)
weight: 30
description: Sign a short-lived JWT with your own private key on every request to a backend.
test:
  jwt-sign:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/security/backend-authn-jwt-sign.md
    path: jwt-sign
---

{{< reuse "agw-docs/pages/security/backend-authn-jwt-sign.md" >}}
