---
title: Cross App Access (ID-JAG)
weight: 50
description: Call a downstream API as the authenticated end user with the OAuth Identity Assertion Authorization Grant.
test:
  cross-app-access:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/security/backend-authn/cross-app-access.md
    path: cross-app-access
aliases:
  - /docs/kubernetes/latest/security/backend-authn-cross-app-access/
  - /docs/kubernetes/latest/documentation/security/backend-authn-cross-app-access/
---

{{< reuse "agw-docs/pages/security/backend-authn-cross-app-access.md" >}}
