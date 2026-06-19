---
title: Sample app
weight: 20
description: Set up the httpbin sample app to try traffic management, security, and resiliency guides.
test:
  install-httpbin:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
---

{{< reuse "agw-docs/pages/install/sample-app.md" >}}
