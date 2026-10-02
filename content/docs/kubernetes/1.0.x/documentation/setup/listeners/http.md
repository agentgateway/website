---
title: HTTP
weight: 10
test:
  http-listener:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/setup/listeners/http.md
    path: http-listener
---

{{< reuse "agw-docs/pages/setup/listeners/http.md" >}}
