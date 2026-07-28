---
title: Cross App Access (ID-JAG)
weight: 20
description: Call a downstream API as the authenticated end user with the OAuth Identity Assertion Authorization Grant.
test:
  cross-app-access:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/security/backend-authn-cross-app-access.md
    path: cross-app-access
---

{{< reuse "agw-docs/pages/security/backend-authn-cross-app-access.md" >}}
