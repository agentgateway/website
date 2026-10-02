---
title: HTTPS
weight: 10
description: Create an HTTPS listener on your gateway proxy to terminate TLS traffic.
test:
  https-listener:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/setup/listeners/https.md
    path: https-listener
---

{{< reuse "agw-docs/pages/setup/listeners/https.md" >}}
