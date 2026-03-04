---
title: CSRF
weight: 10
description: Protect your applications from Cross-Site Request Forgery (CSRF) attacks.
test:
  csrf:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/security/csrf.md
    path: csrf
---

{{< reuse "agw-docs/pages/security/csrf.md" >}}