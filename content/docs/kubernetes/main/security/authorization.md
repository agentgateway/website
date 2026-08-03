---
title: Authorization
weight: 15
description: Control which requests are allowed to reach your backends using authorization policies with Allow, Require, and Deny actions.
test:
  authorization:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/security/authorization.md
    path: authorization
---

{{< reuse "agw-docs/pages/security/authorization.md" >}}
