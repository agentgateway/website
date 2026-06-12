---
title: HTTPS
weight: 10
test:
  https-listener:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/setup/listeners/https.md
    path: https-listener
---

{{< reuse "agw-docs/pages/setup/listeners/https.md" >}}
