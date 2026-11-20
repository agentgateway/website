---
title: Sample app
weight: 20
description: Set up the httpbin sample app to try traffic management, security, and resiliency guides.
test:
  install-httpbin:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
---

{{< reuse "agw-docs/pages/install/sample-app.md" >}}
