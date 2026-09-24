---
title: Standard token exchange (RFC 8693)
weight: 10
description: Exchange the incoming request credential for a per-backend token with the RFC 8693 token exchange grant.
test:
  te-standard:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/security/backend-authn/token-exchange/standard.md
    path: te-standard
aliases:
  - /docs/kubernetes/latest/security/backend-authn-oauth/
  - /docs/kubernetes/latest/documentation/security/backend-authn-oauth/
  - /docs/kubernetes/latest/documentation/security/backend-authn/oauth-token-exchange/
---

{{< reuse "agw-docs/pages/security/backend-authn-te-standard.md" >}}
