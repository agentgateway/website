---
title: JWT bearer grant (RFC 7523)
weight: 20
description: Exchange the incoming request credential for a per-backend token with the RFC 7523 JWT bearer grant.
test:
  te-jwt-bearer:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/security/backend-authn/token-exchange/jwt-bearer.md
    path: te-jwt-bearer
---

{{< reuse "agw-docs/pages/security/backend-authn-te-jwt-bearer.md" >}}
