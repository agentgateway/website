---
title: CSRF
weight: 10
description: Protect your applications from Cross-Site Request Forgery (CSRF) attacks.
test:
  csrf:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/security/csrf.md
    path: csrf
---

{{< reuse "agw-docs/pages/security/csrf.md" >}}