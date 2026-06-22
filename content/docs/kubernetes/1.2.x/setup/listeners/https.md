---
title: HTTPS
weight: 10
description: Create an HTTPS listener on your gateway proxy to terminate TLS traffic.
test:
  https-listener:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/setup/listeners/https.md
    path: https-listener
---

{{< reuse "agw-docs/pages/setup/listeners/https.md" >}}
