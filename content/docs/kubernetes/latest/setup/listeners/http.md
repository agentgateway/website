---
title: HTTP
weight: 10
test:
  http-listener:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/setup/listeners/http.md
    path: http-listener
---

{{< reuse "agw-docs/pages/setup/listeners/http.md" >}}
