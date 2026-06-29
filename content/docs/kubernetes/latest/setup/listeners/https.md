---
title: HTTPS
weight: 10
description: Create an HTTPS listener on your gateway proxy to terminate TLS traffic.
test:
  https-listener:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: https-listener
---

{{< reuse "agw-docs/pages/setup/listeners/https.md" >}}
