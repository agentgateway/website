---
title: CSRF
weight: 10
description: Protect your applications from Cross-Site Request Forgery (CSRF) attacks.
test:
  csrf:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/security/csrf.md
    path: csrf
---

{{< reuse "agw-docs/pages/security/csrf.md" >}}