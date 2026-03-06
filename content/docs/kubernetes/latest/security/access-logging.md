---
title: Access logging
weight: 10
description: Capture an access log for all the requests that enter the proxy.
test:
  access-logging:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/security/access-logging.md
    path: access-logging
---

{{< reuse "agw-docs/pages/security/access-logging.md" >}}