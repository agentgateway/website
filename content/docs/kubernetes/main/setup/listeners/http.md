---
title: HTTP
weight: 10
test:
  http-listener:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/setup/listeners/http.md
    path: http-listener
---

{{< reuse "agw-docs/pages/setup/listeners/http.md" >}}
