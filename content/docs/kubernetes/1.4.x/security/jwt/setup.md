---
title: JWT auth
description: Set up JWT authentication with an identity provider like Keycloak.
weight: 10
test:
  jwt-claims:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/security/jwt/setup.md
    path: setup-keycloak
  - file: ${versionRoot}/security/jwt/setup.md
    path: jwt-claims
---

{{< reuse "agw-docs/pages/security/jwt-setup.md" >}}