---
title: CSRF
weight: 10
description: Protect your applications from Cross-Site Request Forgery (CSRF) attacks.
test:
  csrf:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: csrf
---

{{< reuse "agw-docs/pages/security/csrf.md" >}}